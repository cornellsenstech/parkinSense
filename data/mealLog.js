import AsyncStorage from "@react-native-async-storage/async-storage";
import { DOSE_HOURS } from "./history";

// Meals the patient has logged, kept per patient.
//
// Why this exists: levodopa is a large neutral amino acid, absorbed in the gut
// through the same LAT1 transporter that dietary protein uses. A high-protein
// meal supplies competing amino acids, so it REDUCES how much levodopa gets
// absorbed and crosses into the brain. It does not help absorption. Usual
// advice is to take a dose 30 to 60 minutes before eating, which is why the time
// of a meal matters as much as what was in it.
const keyFor = (patientId) => `parkinsense:meals:${patientId}`;

export const PROTEIN_LEVELS = [
  {
    id: "low",
    label: "Little or none",
    example: "Fruit, toast, vegetables, rice",
  },
  {
    id: "some",
    label: "Some protein",
    example: "Yoghurt, eggs, beans, a little cheese",
  },
  {
    id: "high",
    label: "A lot of protein",
    example: "Meat, fish, protein shake, large dairy portion",
  },
  {
    // Nobody should be blocked from logging a meal because they are unsure how
    // much protein was in it. It can be filled in from History afterwards.
    id: "unsure",
    label: "Not sure",
    example: "Log it now, add this later",
  },
];

// Offsets rather than a time picker: tapping one of four buttons is far easier
// than setting a time with a tremor.
export const WHEN_OPTIONS = [
  { id: "now", label: "Just now", minutesAgo: 0 },
  { id: "30", label: "30 min ago", minutesAgo: 30 },
  { id: "60", label: "1 hour ago", minutesAgo: 60 },
  { id: "120", label: "2 hours ago", minutesAgo: 120 },
];

// A meal within this many minutes of a dose is worth mentioning.
const CLOSE_MINUTES = 60;

export async function loadMeals(patientId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Accepts "8:30 am", "08:30", "8:30" or "20:15" and returns minutes past
// midnight, or null if it cannot be read. Typed time is optional; the quick
// offsets remain the easy path.
export function parseTime(text) {
  if (!text) return null;
  const match = String(text)
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const period = match[3];

  if (minute > 59) return null;
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;

  return hour * 60 + minute;
}

// Returns the saved entry so the caller can offer to undo it.
// `atMinuteOfDay` wins over `minutesAgo` when the patient typed a time.
export async function saveMeal(patientId, { protein, minutesAgo, food, atMinuteOfDay }) {
  let when;
  if (typeof atMinuteOfDay === "number") {
    when = new Date();
    when.setHours(Math.floor(atMinuteOfDay / 60), atMinuteOfDay % 60, 0, 0);
  } else {
    when = new Date(Date.now() - minutesAgo * 60 * 1000);
  }

  const entry = {
    id: `m-${Date.now()}`,
    protein,
    food: (food || "").trim(),
    eatenAt: when.getTime(),
    hour: when.getHours(),
    minuteOfDay: when.getHours() * 60 + when.getMinutes(),
    timeLabel: when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
  try {
    const current = await loadMeals(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify([entry, ...current])
    );
    return entry;
  } catch {
    return null;
  }
}

export async function removeMeal(patientId, entryId) {
  try {
    const current = await loadMeals(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify(current.filter((e) => e.id !== entryId))
    );
    return true;
  } catch {
    return false;
  }
}

// Fill in the protein level later, from History, for a meal logged as "not
// sure" at the time.
export async function setMealProtein(patientId, entryId, protein) {
  try {
    const current = await loadMeals(patientId);
    const next = current.map((m) => (m.id === entryId ? { ...m, protein } : m));
    await AsyncStorage.setItem(keyFor(patientId), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

// How close this meal fell to a scheduled dose, and whether that is worth
// flagging. Only high-protein meals are flagged, because that is the case with
// a real absorption effect.
export function doseProximity(entry) {
  if (!entry) return null;

  let nearest = null;
  DOSE_HOURS.forEach((hour) => {
    const gap = Math.abs(entry.minuteOfDay - hour * 60);
    if (nearest === null || gap < nearest.gap) {
      nearest = { hour, gap };
    }
  });
  if (!nearest) return null;

  const close = nearest.gap <= CLOSE_MINUTES;
  const flag = close && entry.protein === "high";

  return {
    doseHour: nearest.hour,
    minutes: nearest.gap,
    close,
    flag,
    doseLabel: formatHour(nearest.hour),
  };
}

function formatHour(hour) {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${suffix}`;
}

export function proteinLabel(id) {
  const match = PROTEIN_LEVELS.find((p) => p.id === id);
  return match ? match.label : id;
}
