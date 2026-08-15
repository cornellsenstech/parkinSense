-- ParkinSense — Postgres schema and access policies
--
-- Run this once against a fresh Supabase project:
--   supabase db push        (or paste into the SQL editor)
--
-- WHY A DATABASE AT ALL, GIVEN THE WHOLE APP IS LOCAL-FIRST
--
-- The application stores everything on the device and works with no network.
-- That is not a limitation to be removed; it is the reason a patient can use it
-- on a plane, and the reason there is no server holding a pile of health data.
-- So this schema is ADDITIVE. The device remains the source of truth, sync is
-- opt-in, and a patient who never enables it never appears in this database at
-- all.
--
-- What sync buys is the one thing local-only genuinely cannot do: let a
-- clinician see a patient's records from their own machine. Today the demo
-- fakes that by having both browser tabs read the same localStorage. That works
-- for a demo and is a lie about the architecture.
--
-- THE CENTRAL IDEA: THE ISOLATION RULE MOVES INTO THE DATABASE
--
-- On the device, one patient's data cannot leak into another's because every
-- storage key is namespaced — `parkinsense:doses:robert`. That is enforced by
-- the application: a bug in a query could break it.
--
-- Here the same rule is enforced by Postgres itself through row level security.
-- A policy is attached to the table, not the query, so it holds no matter what
-- the client asks for. If the app were compromised tomorrow and asked for every
-- row in dose_events, it would receive only the rows the signed-in user is
-- entitled to. That is the difference between a convention and a guarantee.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per signed-in human, patient or clinician. Mirrors auth.users, which
-- Supabase owns; this table holds the things the application cares about.
--
-- `role` decides which portal opens and which policies apply. It is a column
-- rather than something the client asserts, because a client-side role is a
-- suggestion.
create table if not exists profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role in ('patient', 'clinician')),
  display_name text not null,

  -- Clinical fields, on the patient's row. Age and weight are here because
  -- levodopa absorption and clearance both depend on them.
  age          int,
  weight_lbs   int,
  height_in    int,

  -- The therapeutic window is per patient: it narrows with disease duration and
  -- with dyskinesia. Defaults match the published 500–1500 ng/mL starting point.
  range_low    int not null default 500,
  range_high   int not null default 1500,

  created_at   timestamptz not null default now(),

  -- A window with the floor above the ceiling would silently break every chart
  -- and every forecast. Cheap to forbid outright.
  constraint range_is_ordered check (range_low < range_high)
);

-- Which clinician may see which patient. Explicit rather than implied by a
-- shared clinic id, because "who can read this person's health record" should
-- be a row someone deliberately created and can delete.
create table if not exists care_relationships (
  clinician_id uuid not null references profiles (id) on delete cascade,
  patient_id   uuid not null references profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (clinician_id, patient_id)
);

-- ---------------------------------------------------------------------------
-- Records
--
-- Four append-only logs, one per thing a patient records. Separate tables
-- rather than one events table with a `kind` column: the columns genuinely
-- differ, and a query for "high protein meals within an hour of a dose" is
-- readable against `meals` and miserable against a generic blob.
--
-- Each carries `client_id`, the identifier the device generated. Sync is
-- idempotent on it, so replaying an upload after a dropped connection updates
-- the same row rather than creating a duplicate — which matters because the
-- device may be offline for days and then send everything at once.
-- ---------------------------------------------------------------------------

create table if not exists symptom_entries (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references profiles (id) on delete cascade,
  client_id   text not null,

  -- Who filled it in. Care partners do a large share of real-world logging, and
  -- a clinician must be able to tell a self-report from an observation.
  reporter    text not null check (reporter in ('patient', 'caregiver')),

  -- Ten symptoms scored 0–4. jsonb rather than ten columns because the list has
  -- already changed once — muscle fatigue split into slowness and tiredness,
  -- digestion split into constipation and bloating — and each change would
  -- otherwise be a migration on a table with real patient data in it.
  scores      jsonb not null,
  sleep       text check (sleep in ('good', 'ok', 'bad')),
  note        text,

  recorded_at timestamptz not null,
  synced_at   timestamptz not null default now(),

  unique (patient_id, client_id)
);

create table if not exists dose_events (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references profiles (id) on delete cascade,
  client_id       text not null,
  reporter        text not null check (reporter in ('patient', 'caregiver')),

  -- taken / missed / rescue. A missed dose is a clinical fact, not an absence
  -- of data, which is why it is a row rather than a gap.
  kind            text not null check (kind in ('taken', 'missed', 'rescue')),

  -- Which scheduled dose this answers. Null for a rescue dose, which is
  -- unscheduled by definition.
  scheduled_hour  int check (scheduled_hour between 0 and 23),
  note            text,

  recorded_at     timestamptz not null,
  synced_at       timestamptz not null default now(),

  unique (patient_id, client_id),

  -- A rescue dose that claims a scheduled slot would be double counted in
  -- adherence. Forbidden in the schema so no client can introduce it.
  constraint rescue_has_no_slot
    check (kind <> 'rescue' or scheduled_hour is null)
);

create table if not exists meals (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references profiles (id) on delete cascade,
  client_id    text not null,

  -- Protein competes with levodopa for the same transporter, so the tier is the
  -- clinically relevant part. 'unsure' exists so uncertainty never blocks
  -- logging; it can be filled in later.
  protein      text not null check (protein in ('low', 'some', 'high', 'unsure')),
  food         text,

  recorded_at  timestamptz not null,
  synced_at    timestamptz not null default now(),

  unique (patient_id, client_id)
);

create table if not exists activity_sessions (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references profiles (id) on delete cascade,
  client_id    text not null,
  activity     text not null,
  intensity    text not null check (intensity in ('light', 'moderate', 'vigorous')),
  minutes      int not null check (minutes > 0),

  recorded_at  timestamptz not null,
  synced_at    timestamptz not null default now(),

  unique (patient_id, client_id)
);

-- Every read is "this patient, over this period, newest first". The index
-- matches that shape exactly.
create index if not exists symptom_entries_by_patient
  on symptom_entries (patient_id, recorded_at desc);
create index if not exists dose_events_by_patient
  on dose_events (patient_id, recorded_at desc);
create index if not exists meals_by_patient
  on meals (patient_id, recorded_at desc);
create index if not exists activity_by_patient
  on activity_sessions (patient_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Nothing is readable until a policy says so. `enable` turns the table off by
-- default; each policy below opens exactly one door.
-- ---------------------------------------------------------------------------

alter table profiles            enable row level security;
alter table care_relationships  enable row level security;
alter table symptom_entries     enable row level security;
alter table dose_events         enable row level security;
alter table meals               enable row level security;
alter table activity_sessions   enable row level security;

-- Is the signed-in user a clinician who has been given this patient?
--
-- A function rather than a repeated subquery: the same condition appears in
-- eight policies, and eight copies of a security rule is eight chances to fix
-- seven of them. `security definer` lets it read care_relationships while that
-- table is itself protected. `stable` lets the planner call it once per query.
create or replace function has_care_access(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from care_relationships cr
    where cr.patient_id = target_patient
      and cr.clinician_id = auth.uid()
  );
$$;

-- Profiles: you can always see and edit your own. A clinician can additionally
-- read the profiles of patients assigned to them — they need the therapeutic
-- window to interpret a chart — but cannot edit them.
create policy profiles_read_own on profiles
  for select using (id = auth.uid() or has_care_access(id));

create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

-- Care relationships are visible to both sides of the relationship.
create policy care_read on care_relationships
  for select using (clinician_id = auth.uid() or patient_id = auth.uid());

-- Records. The pattern is identical across all four tables, and deliberately
-- so — a reader should be able to check one and trust the rest.
--
-- WRITE is restricted to the patient themselves. A clinician can read a record
-- and write a note about it, but must never be able to alter what the patient
-- reported. `with check` covers inserts and updates, so a row cannot be written
-- and then reassigned to somebody else.
create policy symptoms_read on symptom_entries
  for select using (patient_id = auth.uid() or has_care_access(patient_id));
create policy symptoms_write on symptom_entries
  for insert with check (patient_id = auth.uid());
create policy symptoms_update on symptom_entries
  for update using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy doses_read on dose_events
  for select using (patient_id = auth.uid() or has_care_access(patient_id));
create policy doses_write on dose_events
  for insert with check (patient_id = auth.uid());
create policy doses_update on dose_events
  for update using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy meals_read on meals
  for select using (patient_id = auth.uid() or has_care_access(patient_id));
create policy meals_write on meals
  for insert with check (patient_id = auth.uid());
create policy meals_update on meals
  for update using (patient_id = auth.uid()) with check (patient_id = auth.uid());

create policy activity_read on activity_sessions
  for select using (patient_id = auth.uid() or has_care_access(patient_id));
create policy activity_write on activity_sessions
  for insert with check (patient_id = auth.uid());
create policy activity_update on activity_sessions
  for update using (patient_id = auth.uid()) with check (patient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Verifying the isolation actually holds
--
-- Run as two different signed-in users. The second must return zero rows — if
-- it returns anything, a policy is wrong and no amount of careful client code
-- will save you.
--
--   -- as patient A
--   insert into dose_events (patient_id, client_id, reporter, kind, recorded_at)
--   values (auth.uid(), 'test-1', 'patient', 'taken', now());
--
--   -- as patient B, with no care relationship
--   select count(*) from dose_events;   -- expect 0
--
--   -- as a clinician, after: insert into care_relationships values (me, A)
--   select count(*) from dose_events;   -- expect 1
-- ---------------------------------------------------------------------------
