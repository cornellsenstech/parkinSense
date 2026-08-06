import AsyncStorage from "@react-native-async-storage/async-storage";
import { DOSE_HOURS } from "./history";

// What actually happened with each dose, kept per patient, newest first.
//
// Why this matters more than it looks: the forecast can see the level falling
// but has no idea whether a dose is coming, so a missed dose and a normal
// pre-dose trough look identical on the concentration chart. Recording taken /
// missed / rescue is what separates "the medication is wearing off on schedule"
// from "there is no medication on board", and those need opposite responses.
//
// A rescue dose is an extra, unscheduled dose taken to end an off period. It is
// stored as its own kind rather than as a normal dose, because a clinician
// counting rescue doses per week is looking at how well the regimen is holding.
const keyFor = (patientId) => `parkinsense:doses:${patientId}`;

export const DOSE_KINDS = [
  {
    id: "taken",
    label: "Took it",
    short: "Taken",
    icon: "checkmark-circle",
    colour: "#166534",
    tint: "#dcfce7",
  },
  {
    id: "missed",
    label: "Missed it",
    short: "Missed",
    icon: "close-circle",
    colour: "#991b1b",
    tint: "#fee2e2",
  },
  {
    id: "rescue",
    label: "Extra dose",
    short: "Rescue",
    icon: "add-circle",
    colour: "#9a3412",
    tint: "#ffedd5",
  },
];

// A dose logged within this many minutes of a scheduled time is treated as that
// scheduled dose rather than an unscheduled one.
const MATCH_MINUTES = 90;

// How long before a scheduled dose the reminder starts showing.
const REMIND_AHEAD_MINUTES = 30;

// How long after a scheduled time it stays "due" before it counts as overdue.
const OVERDUE_MINUTES = 45;

export function doseKind(id) {
  return DOSE_KINDS.find((k) => k.id === id) || DOSE_KINDS[0];
}

export async function loadDoses(patientId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// `kind` is taken | missed | rescue. `atMinuteOfDay` wins over `minutesAgo`
// when the patient typed a time, matching how meals are logged.
export async function saveDose(
  patientId,
  { kind, minutesAgo = 0, atMinuteOfDay, scheduledHour, by, note }
) {
  let when;
  if (typeof atMinuteOfDay === "number") {
    when = new Date();
    when.setHours(Math.floor(atMinuteOfDay / 60), atMinuteOfDay % 60, 0, 0);
  } else {
    when = new Date(Date.now() - minutesAgo * 60 * 1000);
  }

  const minuteOfDay = when.getHours() * 60 + when.getMinutes();
  const entry = {
    id: `d-${Date.now()}`,
    kind: DOSE_KINDS.some((k) => k.id === kind) ? kind : "taken",
    by: by === "caregiver" ? "caregiver" : "patient",
    note: (note || "").trim(),
    // Which scheduled dose this belongs to, if any. Null for a rescue dose.
    scheduledHour:
      typeof scheduledHour === "number" ? scheduledHour : nearestScheduled(minuteOfDay),
    takenAt: when.getTime(),
    hour: when.getHours(),
    minuteOfDay,
    timeLabel: when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };

  try {
    const current = await loadDoses(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify([entry, ...current])
    );
    return entry;
  } catch {
    return null;
  }
}

export async function removeDose(patientId, entryId) {
  try {
    const current = await loadDoses(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify(current.filter((e) => e.id !== entryId))
    );
    return true;
  } catch {
    return false;
  }
}

// The scheduled dose this time is closest to, or null if it is not close to any
// of them — which is what makes it an unscheduled, rescue-shaped dose.
function nearestScheduled(minuteOfDay) {
  let best = null;
  DOSE_HOURS.forEach((hour) => {
    const gap = Math.abs(minuteOfDay - hour * 60);
    if (best === null || gap < best.gap) best = { hour, gap };
  });
  return best && best.gap <= MATCH_MINUTES ? best.hour : null;
}

function startOfDay(time = Date.now()) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dosesToday(entries, now = Date.now()) {
  const from = startOfDay(now);
  return entries.filter((e) => e.takenAt >= from);
}

// The reminder shown on Home: which scheduled dose is next, whether it is due
// now, and whether one has quietly gone unanswered.
//
// Deliberately not a notification. The app has no background scheduler on the
// web, and promising a reminder that only fires when the app happens to be open
// would be worse than not promising one.
export function doseSchedule(entries, now = new Date()) {
  const minuteNow = now.getHours() * 60 + now.getMinutes();
  const today = dosesToday(entries, now.getTime());

  const answered = new Set(
    today
      .filter((e) => e.scheduledHour != null && e.kind !== "rescue")
      .map((e) => e.scheduledHour)
  );

  const slots = DOSE_HOURS.map((hour) => {
    const minute = hour * 60;
    const logged = today.find(
      (e) => e.scheduledHour === hour && e.kind !== "rescue"
    );
    let state;
    if (logged) state = logged.kind;
    else if (minuteNow > minute + OVERDUE_MINUTES) state = "overdue";
    else if (minuteNow >= minute - REMIND_AHEAD_MINUTES) state = "due";
    else state = "upcoming";
    return { hour, minute, label: formatHour(hour), state, logged: logged || null };
  });

  const due = slots.find((s) => s.state === "due");
  const overdue = slots.find((s) => s.state === "overdue");
  const next = slots.find((s) => s.state === "upcoming");

  return {
    slots,
    due: due || null,
    overdue: overdue || null,
    next: next || null,
    answeredCount: answered.size,
    total: DOSE_HOURS.length,
    rescueToday: today.filter((e) => e.kind === "rescue").length,
  };
}

// One plain sentence for the reminder card, and never an instruction to take
// anything — the app states what is scheduled and what has been logged, and
// stops there.
export function describeSchedule(schedule) {
  if (!schedule) return null;
  if (schedule.overdue) {
    return {
      tone: "warn",
      headline: `Your ${schedule.overdue.label} dose is not logged`,
      detail: "Tap below to record whether you took it or missed it.",
    };
  }
  if (schedule.due) {
    return {
      tone: "due",
      headline: `Your ${schedule.due.label} dose is due`,
      detail: "Record it here once you have taken it.",
    };
  }
  if (schedule.next) {
    return {
      tone: "calm",
      headline: `Next dose at ${schedule.next.label}`,
      detail: `${schedule.answeredCount} of ${schedule.total} logged so far today.`,
    };
  }
  return {
    tone: "good",
    headline: "All of today's doses are logged",
    detail: `${schedule.answeredCount} of ${schedule.total} recorded.`,
  };
}

function formatHour(hour) {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${suffix}`;
}

// Counts a clinician reads at a glance, over whatever window they are looking
// at. Adherence deliberately ignores rescue doses: taking an extra dose is not
// the same as taking a scheduled one, and averaging them hides both.
export function doseSummary(entries, days = 7, now = Date.now()) {
  const from = now - days * 24 * 60 * 60 * 1000;
  const window = entries.filter((e) => e.takenAt >= from);

  const taken = window.filter((e) => e.kind === "taken").length;
  const missed = window.filter((e) => e.kind === "missed").length;
  const rescue = window.filter((e) => e.kind === "rescue").length;
  const scheduled = taken + missed;

  return {
    days,
    taken,
    missed,
    rescue,
    scheduled,
    adherence: scheduled ? Math.round((taken / scheduled) * 100) : null,
  };
}
