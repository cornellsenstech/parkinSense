import AsyncStorage from "@react-native-async-storage/async-storage";

// Activity the patient has logged, kept per patient, newest first.
//
// Why this sits next to the meal log: exercise is the only intervention in
// Parkinson's with consistent evidence for improving motor symptoms, and there
// is good evidence it supports dopamine signalling and neuroplasticity rather
// than merely making people fitter. Recording it alongside levels and symptoms
// lets a clinician see whether the good days are the active ones.
//
// Stated carefully on purpose: the app does not claim a single walk raises a
// levodopa reading. The honest claim is that activity tracks with how the day
// goes, and that is what the chart shows.
const keyFor = (patientId) => `parkinsense:exercise:${patientId}`;

export const INTENSITIES = [
  {
    id: "light",
    label: "Light",
    example: "Gentle walk, stretching, housework",
    value: 1,
    colour: "#bbf7d0",
    ink: "#166534",
  },
  {
    id: "moderate",
    label: "Moderate",
    example: "Brisk walk, cycling, dancing, a class",
    value: 2,
    colour: "#4ade80",
    ink: "#14532d",
  },
  {
    id: "vigorous",
    label: "Vigorous",
    example: "Out of breath, hard to hold a conversation",
    value: 3,
    colour: "#15803d",
    ink: "#f0fdf4",
  },
];

// Common activities as one-tap presets. The field stays free text underneath,
// because boxing people into a fixed list is how logging stops happening.
export const ACTIVITY_PRESETS = [
  "Walking",
  "Cycling",
  "Exercise class",
  "Physiotherapy",
  "Swimming",
  "Gardening",
  "Housework",
  "Dancing",
  "Boxing",
  "Stretching",
];

// Same offsets as the meal log, so the two cards behave identically.
export const WHEN_OPTIONS = [
  { id: "now", label: "Just now", minutesAgo: 0 },
  { id: "60", label: "1 hour ago", minutesAgo: 60 },
  { id: "180", label: "3 hours ago", minutesAgo: 180 },
  { id: "360", label: "This morning", minutesAgo: 360 },
];

export const DURATIONS = [10, 20, 30, 45, 60];

export function intensity(id) {
  return INTENSITIES.find((i) => i.id === id) || INTENSITIES[0];
}

export function intensityLabel(id) {
  return intensity(id).label;
}

export async function loadExercise(patientId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveExercise(
  patientId,
  { activity, level, minutes, minutesAgo = 0, atMinuteOfDay, by }
) {
  let when;
  if (typeof atMinuteOfDay === "number") {
    when = new Date();
    when.setHours(Math.floor(atMinuteOfDay / 60), atMinuteOfDay % 60, 0, 0);
  } else {
    when = new Date(Date.now() - minutesAgo * 60 * 1000);
  }

  const entry = {
    id: `x-${Date.now()}`,
    activity: (activity || "").trim() || "Activity",
    level: INTENSITIES.some((i) => i.id === level) ? level : "light",
    minutes: Number(minutes) > 0 ? Number(minutes) : 20,
    by: by === "caregiver" ? "caregiver" : "patient",
    doneAt: when.getTime(),
    hour: when.getHours(),
    minuteOfDay: when.getHours() * 60 + when.getMinutes(),
    timeLabel: when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };

  try {
    const current = await loadExercise(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify([entry, ...current])
    );
    return entry;
  } catch {
    return null;
  }
}

export async function removeExercise(patientId, entryId) {
  try {
    const current = await loadExercise(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify(current.filter((e) => e.id !== entryId))
    );
    return true;
  } catch {
    return false;
  }
}

// Minutes per day over a window, plus how many days had any activity at all.
// Active days is the number a clinician tends to ask for first — consistency
// matters more here than a single long session.
export function exerciseSummary(entries, days = 7, now = Date.now()) {
  const from = now - days * 24 * 60 * 60 * 1000;
  const window = entries.filter((e) => e.doneAt >= from);

  const totalMinutes = window.reduce((sum, e) => sum + (e.minutes || 0), 0);
  const dayKeys = new Set(
    window.map((e) => new Date(e.doneAt).toDateString())
  );
  const moderatePlus = window.filter((e) => e.level !== "light");

  return {
    days,
    sessions: window.length,
    totalMinutes,
    activeDays: dayKeys.size,
    perDay: Math.round(totalMinutes / days),
    moderateMinutes: moderatePlus.reduce((sum, e) => sum + (e.minutes || 0), 0),
  };
}
