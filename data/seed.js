import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyScores } from "./symptoms";

// Two days of plausible check-ins and meals, written once per patient so the
// charts have something to show before anyone has typed anything.
//
// It only ever seeds an empty store. Anything the patient or caregiver records
// is never touched or overwritten, and a `seeded` marker stops it running again
// after they clear their own entries.
const symptomKey = (id) => `parkinsense:symptoms:${id}`;
const mealKey = (id) => `parkinsense:meals:${id}`;
const markerKey = (id) => `parkinsense:seeded:${id}`;

// Severity roughly tracks how far the level sat outside the window, so the
// symptom lines and the concentration chart tell a consistent story.
const FACTOR = { robert: 1, margaret: 1.6, frank: 1.15, helen: 1.4 };

// hoursAgo, who recorded it, and a severity multiplier for that moment.
const CHECK_INS = [
  { hoursAgo: 34, by: "patient", level: 1, sleep: "ok", note: "" },
  { hoursAgo: 30, by: "caregiver", level: 2, sleep: null, note: "Slower than usual getting dressed." },
  { hoursAgo: 26, by: "patient", level: 1, sleep: null, note: "" },
  { hoursAgo: 22, by: "patient", level: 0, sleep: "good", note: "Good afternoon, felt steady." },
  { hoursAgo: 12, by: "patient", level: 2, sleep: "bad", note: "Woke up several times." },
  { hoursAgo: 9, by: "caregiver", level: 3, sleep: null, note: "Very stiff before the morning dose." },
  { hoursAgo: 6, by: "patient", level: 1, sleep: null, note: "" },
  { hoursAgo: 3, by: "patient", level: 1, sleep: null, note: "Voice felt quiet on the phone." },
];

// Which symptoms move with severity, and how strongly.
const WEIGHTS = {
  stiffness: 1,
  tremor: 0.9,
  fatigue: 0.8,
  pain: 0.5,
  cognition: 0.6,
  speech: 0.5,
  digestion: 0.4,
};

const MEALS = [
  { hoursAgo: 33, protein: "low", food: "Toast and tea" },
  { hoursAgo: 29, protein: "high", food: "Chicken sandwich" },
  { hoursAgo: 23, protein: "some", food: "Yoghurt and fruit" },
  { hoursAgo: 14, protein: "low", food: "Porridge" },
  { hoursAgo: 10, protein: "high", food: "Eggs and bacon" },
  { hoursAgo: 5, protein: "unsure", food: "Leftovers from yesterday" },
];

function scoresFor(level, factor) {
  const scores = emptyScores();
  Object.keys(WEIGHTS).forEach((id) => {
    const raw = level * factor * WEIGHTS[id];
    scores[id] = Math.max(0, Math.min(4, Math.round(raw)));
  });
  return scores;
}

function stamp(hoursAgo) {
  const when = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return {
    savedAt: when.getTime(),
    eatenAt: when.getTime(),
    hour: when.getHours(),
    minuteOfDay: when.getHours() * 60 + when.getMinutes(),
    timeLabel: when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

export async function seedIfEmpty(patientId) {
  if (!patientId) return;
  try {
    const [marker, symptoms, meals] = await Promise.all([
      AsyncStorage.getItem(markerKey(patientId)),
      AsyncStorage.getItem(symptomKey(patientId)),
      AsyncStorage.getItem(mealKey(patientId)),
    ]);
    if (marker) return; // already seeded once, never do it again

    const factor = FACTOR[patientId] || 1;

    // Newest first, matching how both stores are written.
    if (!symptoms || JSON.parse(symptoms).length === 0) {
      const entries = CHECK_INS.map((c, i) => {
        const at = stamp(c.hoursAgo);
        return {
          id: `seed-s-${i}`,
          by: c.by,
          scores: scoresFor(c.level, factor),
          sleep: c.sleep,
          note: c.note,
          savedAt: at.savedAt,
          hour: at.hour,
          timeLabel: at.timeLabel,
        };
      }).sort((a, b) => b.savedAt - a.savedAt);
      await AsyncStorage.setItem(symptomKey(patientId), JSON.stringify(entries));
    }

    if (!meals || JSON.parse(meals).length === 0) {
      const entries = MEALS.map((m, i) => {
        const at = stamp(m.hoursAgo);
        return {
          id: `seed-m-${i}`,
          protein: m.protein,
          food: m.food,
          eatenAt: at.eatenAt,
          hour: at.hour,
          minuteOfDay: at.minuteOfDay,
          timeLabel: at.timeLabel,
        };
      }).sort((a, b) => b.eatenAt - a.eatenAt);
      await AsyncStorage.setItem(mealKey(patientId), JSON.stringify(entries));
    }

    await AsyncStorage.setItem(markerKey(patientId), "1");
  } catch {
    // Seeding is a convenience. If it fails the app still works, just empty.
  }
}
