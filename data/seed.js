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

// Fourteen days of history, roughly three check-ins a day.
//
// Rather than write ~120 rows by hand, the pattern is generated: severity peaks
// before a dose and settles after it, with a slow upward drift across the two
// weeks so a clinician has an actual trend to find rather than noise.
const NOTES_BAD = [
  "Very stiff before the morning dose.",
  "Slower than usual getting dressed.",
  "Struggled to get out of the chair.",
  "Handwriting was hard to read today.",
  "Froze in the doorway twice.",
  "Voice felt quiet on the phone.",
];
const NOTES_OK = [
  "Steady afternoon.",
  "Managed the stairs without help.",
  "Felt like a normal day.",
  "Walked to the shop and back.",
];

// Severity by hour of day: worst before the 7am dose, easing after each one.
const HOUR_SEVERITY = {
  7: 3, // pre-dose trough
  8: 1,
  12: 2, // wearing off before lunch dose
  13: 1,
  17: 2, // wearing off before evening dose
  18: 1,
  21: 2,
};

const CHECK_IN_HOURS = [8, 13, 21];

function buildCheckIns() {
  const rows = [];
  const days = 14;

  for (let day = days - 1; day >= 0; day--) {
    // A slow worsening trend across the fortnight: older days are slightly
    // better than recent ones.
    const drift = (days - 1 - day) / (days - 1); // 0 oldest → 1 today

    CHECK_IN_HOURS.forEach((hour, slot) => {
      const hoursAgo = day * 24 + (21 - hour);
      if (hoursAgo <= 0) return;

      const base = HOUR_SEVERITY[hour] ?? 1;
      const level = Math.min(4, base + (drift > 0.6 ? 1 : 0));

      // A caregiver logs the difficult morning ones more often than the rest.
      const by = hour === 8 && day % 2 === 0 ? "caregiver" : "patient";

      let note = "";
      if (level >= 3 && day % 3 === 0) {
        note = NOTES_BAD[(day + slot) % NOTES_BAD.length];
      } else if (level <= 1 && day % 4 === 0) {
        note = NOTES_OK[(day + slot) % NOTES_OK.length];
      }

      const sleep =
        hour === 8 ? (level >= 3 ? "bad" : drift > 0.5 ? "ok" : "good") : null;

      rows.push({ hoursAgo, by, level, sleep, note });
    });
  }
  return rows;
}

const CHECK_INS = buildCheckIns();

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

// Three meals a day across the same fortnight, cycling through plausible plates
// so the protein overlay has something to correlate against.
const BREAKFASTS = [
  { protein: "low", food: "Toast and tea" },
  { protein: "low", food: "Porridge with honey" },
  { protein: "some", food: "Yoghurt and fruit" },
  { protein: "high", food: "Eggs and bacon" },
];
const LUNCHES = [
  { protein: "high", food: "Chicken sandwich" },
  { protein: "some", food: "Lentil soup and bread" },
  { protein: "low", food: "Jacket potato and salad" },
  { protein: "high", food: "Tuna salad" },
];
const DINNERS = [
  { protein: "high", food: "Roast chicken and vegetables" },
  { protein: "high", food: "Salmon and rice" },
  { protein: "some", food: "Pasta with tomato sauce" },
  { protein: "unsure", food: "Leftovers" },
];

function buildMeals() {
  const rows = [];
  const days = 14;

  for (let day = days - 1; day >= 0; day--) {
    [
      { hour: 8, list: BREAKFASTS },
      { hour: 13, list: LUNCHES },
      { hour: 19, list: DINNERS },
    ].forEach(({ hour, list }, slot) => {
      const hoursAgo = day * 24 + (21 - hour);
      if (hoursAgo <= 0) return;
      const pick = list[(day + slot) % list.length];
      rows.push({ hoursAgo, ...pick });
    });
  }
  return rows;
}

const MEALS = buildMeals();

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
