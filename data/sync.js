import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Optional sync to Postgres, via Supabase.
//
// THE DEVICE REMAINS THE SOURCE OF TRUTH
//
// Everything the patient records is written to AsyncStorage first and read from
// AsyncStorage always. This module never sits in the path of a save, and every
// screen works identically with sync switched off, the project unconfigured, or
// the network down. That is not a fallback bolted on afterwards — it is the
// architecture, and sync is a mirror of it.
//
// The ordering matters. A sync-first design fails closed: no network, no
// logging. For someone recording a symptom during an off period, that is the
// worst possible moment to ask for a connection.
//
// WHAT SYNC IS ACTUALLY FOR
//
// One thing local-only genuinely cannot do: let a clinician open a patient's
// record on their own machine. The current demo fakes it by having both browser
// tabs read the same localStorage, which works for a demo and misrepresents the
// architecture. This is the honest version of that.
//
// UNCONFIGURED IS A FIRST-CLASS STATE
//
// With no URL and key in the environment, every function here returns quietly
// and `isConfigured()` reports false. The application does not branch on it
// beyond showing whether sync is on. A health app that degrades into error
// dialogs because an env var is missing is worse than one that simply stays
// local.
const URL_KEY = "EXPO_PUBLIC_SUPABASE_URL";
const ANON_KEY = "EXPO_PUBLIC_SUPABASE_ANON_KEY";

// Opt-in, per device, remembered. Off until somebody says otherwise.
const ENABLED_KEY = "parkinsense:sync:enabled";
const CURSOR_KEY = "parkinsense:sync:cursor";

// Which local store maps to which table, and how a stored row becomes a row in
// Postgres. Declared once so adding a synced store is a single entry rather
// than a new function.
export const SYNCED = [
  {
    store: "symptoms",
    table: "symptom_entries",
    key: (id) => `parkinsense:symptoms:${id}`,
    stamp: "savedAt",
    toRow: (e, patientId) => ({
      patient_id: patientId,
      client_id: e.id,
      reporter: e.by === "caregiver" ? "caregiver" : "patient",
      scores: e.scores,
      sleep: e.sleep || null,
      note: e.note || null,
      recorded_at: new Date(e.savedAt).toISOString(),
    }),
  },
  {
    store: "doses",
    table: "dose_events",
    key: (id) => `parkinsense:doses:${id}`,
    stamp: "takenAt",
    toRow: (e, patientId) => ({
      patient_id: patientId,
      client_id: e.id,
      reporter: e.by === "caregiver" ? "caregiver" : "patient",
      kind: e.kind,
      // The schema forbids a rescue dose claiming a scheduled slot, because it
      // would be double counted in adherence. Enforced here too so the round
      // trip never produces a row the database will reject.
      scheduled_hour: e.kind === "rescue" ? null : e.scheduledHour,
      note: e.note || null,
      recorded_at: new Date(e.takenAt).toISOString(),
    }),
  },
  {
    store: "meals",
    table: "meals",
    key: (id) => `parkinsense:meals:${id}`,
    stamp: "eatenAt",
    toRow: (e, patientId) => ({
      patient_id: patientId,
      client_id: e.id,
      protein: e.protein,
      food: e.food || null,
      recorded_at: new Date(e.eatenAt).toISOString(),
    }),
  },
  {
    store: "exercise",
    table: "activity_sessions",
    key: (id) => `parkinsense:exercise:${id}`,
    stamp: "doneAt",
    toRow: (e, patientId) => ({
      patient_id: patientId,
      client_id: e.id,
      activity: e.activity,
      intensity: e.level,
      minutes: e.minutes,
      recorded_at: new Date(e.doneAt).toISOString(),
    }),
  },
];

let clientPromise = null;

function config() {
  const url = process.env[URL_KEY];
  const key = process.env[ANON_KEY];
  return url && key ? { url, key } : null;
}

export function isConfigured() {
  return Platform.OS === "web" && config() !== null;
}

// The client library is a dependency but loaded on demand, so a user who never
// turns sync on never downloads it. Same reasoning as the language model.
async function client() {
  if (!isConfigured()) return null;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { url, key } = config();
    return createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        // The session has to survive a reload, or a patient signs in every time
        // they open the app.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  })().catch((error) => {
    clientPromise = null;
    throw error;
  });

  return clientPromise;
}

export async function isEnabled() {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setEnabled(on) {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    // Failing to remember the preference costs one extra tap later.
  }
}

async function readStore(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Where the last successful upload got to, per store, so a normal sync sends
// what changed rather than the whole history every time.
async function cursors() {
  try {
    const raw = await AsyncStorage.getItem(CURSOR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Push local records upward.
//
// Seeded demo rows are skipped: they are the same fabricated fortnight on every
// device, and uploading them would put invented history into a real account.
//
// Idempotent on (patient_id, client_id). A dropped connection mid-upload is
// recovered by simply running again — the rows that arrived are updated in
// place rather than duplicated, which is what makes retry safe rather than
// merely likely to work.
export async function push(patientId, { since = null } = {}) {
  const db = await client();
  if (!db || !(await isEnabled())) {
    return { skipped: true, reason: isConfigured() ? "disabled" : "unconfigured" };
  }

  const marks = await cursors();
  const result = { uploaded: 0, byStore: {}, errors: [] };

  for (const spec of SYNCED) {
    const from = since ?? marks[spec.store] ?? 0;
    const rows = (await readStore(spec.key(patientId)))
      .filter((e) => !String(e.id || "").startsWith("seed-"))
      .filter((e) => (e[spec.stamp] || 0) > from);

    if (!rows.length) {
      result.byStore[spec.store] = 0;
      continue;
    }

    const { error } = await db
      .from(spec.table)
      .upsert(rows.map((e) => spec.toRow(e, patientId)), {
        onConflict: "patient_id,client_id",
      });

    if (error) {
      // One table failing must not abandon the rest. The cursor for this store
      // is left where it was, so the next run retries exactly these rows.
      result.errors.push({ store: spec.store, message: error.message });
      continue;
    }

    const newest = Math.max(...rows.map((e) => e[spec.stamp] || 0));
    marks[spec.store] = newest;
    result.uploaded += rows.length;
    result.byStore[spec.store] = rows.length;
  }

  try {
    await AsyncStorage.setItem(CURSOR_KEY, JSON.stringify(marks));
  } catch {
    // A lost cursor costs a redundant upload next time, which upsert absorbs.
  }

  return result;
}

// Read one patient's records. Used by the clinician portal, where the rows come
// from Postgres rather than from local storage, because the clinician's device
// never held them.
//
// Row level security means this returns nothing unless the signed-in user is
// that patient or has a care relationship with them. The filter below is a
// convenience, not the protection.
export async function pullFor(patientId, { days = 14 } = {}) {
  const db = await client();
  if (!db) return null;

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const out = {};

  for (const spec of SYNCED) {
    const { data, error } = await db
      .from(spec.table)
      .select("*")
      .eq("patient_id", patientId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false });

    out[spec.store] = error ? [] : data;
  }
  return out;
}

export async function signIn(email, password) {
  const db = await client();
  if (!db) return { error: "Sync is not configured on this build." };
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : { user: data.user };
}

export async function signOut() {
  const db = await client();
  await db?.auth.signOut();
}

export async function currentUser() {
  const db = await client();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data?.user ?? null;
}

// Status for the settings row: enough to tell a patient exactly where their
// data is, in one sentence, without them having to infer it.
export async function status() {
  if (!isConfigured()) {
    return {
      state: "unconfigured",
      label: "This build has no sync. Everything stays on this device.",
    };
  }
  if (!(await isEnabled())) {
    return {
      state: "off",
      label: "Sync is off. Everything stays on this device.",
    };
  }
  const user = await currentUser();
  return user
    ? {
        state: "on",
        label: `Syncing to your care team's record as ${user.email}.`,
      }
    : {
        state: "signed-out",
        label: "Sync is on but you are signed out, so nothing is being sent.",
      };
}
