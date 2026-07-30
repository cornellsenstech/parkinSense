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
    weight: 0,
  },
  {
    id: "some",
    label: "Some protein",
    example: "Yoghurt, eggs, beans, a little cheese",
    weight: 1,
  },
  {
    id: "high",
    label: "High protein",
    example: "Meat, fish, protein shake, large dairy portion",
    weight: 2,
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

// Returns the saved entry so the caller can offer to undo it.
export async function saveMeal(patientId, { protein, minutesAgo }) {
  const when = new Date(Date.now() - minutesAgo * 60 * 1000);
  const entry = {
    id: `m-${Date.now()}`,
    protein,
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
