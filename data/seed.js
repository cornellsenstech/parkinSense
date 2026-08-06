import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyScores } from "./symptoms";

// Two weeks of plausible check-ins, meals, doses and activity, written once per
// patient so the charts have something to show before anyone has typed
// anything.
//
// It only ever seeds an empty store, and anything a patient or caregiver
// recorded themselves is never touched. A `seeded` marker stops it running
// again after they clear their own entries.
//
// The marker is versioned. When the symptom list changed, previously seeded
// rows were missing the new symptoms entirely and would have drawn two flat
// lines at zero, so a version bump re-seeds rows this file wrote (`seed-` ids)
// while leaving genuine entries alone.
const SEED_VERSION = 2;

const symptomKey = (id) => `parkinsense:symptoms:${id}`;
const mealKey = (id) => `parkinsense:meals:${id}`;
const doseKey = (id) => `parkinsense:doses:${id}`;
const exerciseKey = (id) => `parkinsense:exercise:${id}`;
const markerKey = (id) => `parkinsense:seeded:${id}`;

// Severity roughly tracks how far the level sat outside the window, so the
// symptom lines and the concentration chart tell a consistent story.
const FACTOR = { robert: 1, margaret: 1.6, frank: 1.15, helen: 1.4 };

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

// Extra movements run the opposite way to everything else: they peak when the
// level is at its highest, shortly after a dose, not when it has worn off.
// Seeding them on the same curve as stiffness would have taught the chart a
// relationship that does not exist.
const HOUR_PEAK = {
  8: 2, // just after the 7am dose
  13: 2, // just after the lunch dose
  21: 0, // long after the evening dose
};

const CHECK_IN_HOURS = [8, 13, 21];
const DAYS = 14;

function buildCheckIns() {
  const rows = [];

  for (let day = DAYS - 1; day >= 0; day--) {
    // A slow worsening trend across the fortnight: older days are slightly
    // better than recent ones.
    const drift = (DAYS - 1 - day) / (DAYS - 1); // 0 oldest → 1 today

    CHECK_IN_HOURS.forEach((hour, slot) => {
      const hoursAgo = day * 24 + (21 - hour);
      if (hoursAgo <= 0) return;

      const base = HOUR_SEVERITY[hour] ?? 1;
      const level = Math.min(4, base + (drift > 0.6 ? 1 : 0));
      const peak = HOUR_PEAK[hour] ?? 0;

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

      rows.push({ hoursAgo, by, level, peak, sleep, note });
    });
  }
  return rows;
}

const CHECK_INS = buildCheckIns();

// Which symptoms move with the wearing-off curve, and how strongly. Dyskinesia
// is absent here because it is driven by HOUR_PEAK instead.
const WEIGHTS = {
  stiffness: 1,
  tremor: 0.9,
  slowness: 0.85,
  fatigue: 0.8,
  pain: 0.5,
  cognition: 0.6,
  speech: 0.5,
  constipation: 0.4,
  bloating: 0.35,
};

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
  for (let day = DAYS - 1; day >= 0; day--) {
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

// Doses across the same fortnight. Mostly taken, with a scattering of missed
// ones and the occasional rescue dose on a bad afternoon — a perfect adherence
// record would make the whole feature pointless to demonstrate.
const DOSE_TIMES = [7, 13, 18];

function buildDoses() {
  const rows = [];
  for (let day = DAYS - 1; day >= 0; day--) {
    DOSE_TIMES.forEach((hour, slot) => {
      const hoursAgo = day * 24 + (21 - hour);
      if (hoursAgo <= 0) return;

      // One missed dose roughly every five days, always the middle one, which
      // is the one people forget when the day gets away from them.
      const missed = slot === 1 && day % 5 === 2;
      rows.push({
        hoursAgo,
        kind: missed ? "missed" : "taken",
        scheduledHour: hour,
        by: hour === 7 && day % 2 === 0 ? "caregiver" : "patient",
        note: missed ? "Forgot until it was too late to take it." : "",
      });

      // A rescue dose a few hours later on the days the middle dose was missed.
      if (missed) {
        rows.push({
          hoursAgo: hoursAgo - 3,
          kind: "rescue",
          scheduledHour: null,
          by: "patient",
          note: "Off period would not lift.",
        });
      }
    });
  }
  return rows;
}

const DOSES = buildDoses();

// Activity on roughly four days in seven, which is a realistic pattern rather
// than an aspirational one.
const ACTIVITIES = [
  { activity: "Walking", level: "moderate", minutes: 30 },
  { activity: "Exercise class", level: "moderate", minutes: 45 },
  { activity: "Gardening", level: "light", minutes: 30 },
  { activity: "Physiotherapy", level: "moderate", minutes: 45 },
  { activity: "Walking", level: "light", minutes: 20 },
  { activity: "Cycling", level: "vigorous", minutes: 30 },
];

function buildExercise() {
  const rows = [];
  for (let day = DAYS - 1; day >= 0; day--) {
    // Skip roughly three days a week.
    if (day % 7 === 1 || day % 7 === 4 || day % 7 === 6) continue;
    const pick = ACTIVITIES[day % ACTIVITIES.length];
    const hour = day % 2 === 0 ? 10 : 15;
    const hoursAgo = day * 24 + (21 - hour);
    if (hoursAgo <= 0) continue;
    rows.push({ hoursAgo, ...pick });
  }
  return rows;
}

const EXERCISE = buildExercise();

function scoresFor(level, peak, factor) {
  const scores = emptyScores();
  Object.keys(WEIGHTS).forEach((id) => {
    const raw = level * factor * WEIGHTS[id];
    scores[id] = Math.max(0, Math.min(4, Math.round(raw)));
  });
  // Peak-dose dyskinesia, scaled the same way as everything else so the
  // patients who run high show more of it.
  scores.dyskinesia = Math.max(0, Math.min(4, Math.round(peak * factor)));
  return scores;
}

function stamp(hoursAgo) {
  const when = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return {
    at: when.getTime(),
    hour: when.getHours(),
    minuteOfDay: when.getHours() * 60 + when.getMinutes(),
    timeLabel: when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

// True when the store holds nothing, or nothing but rows this file wrote.
// Genuine entries block a re-seed; our own leftovers do not.
async function replaceable(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return true;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return true;
    return list.every((e) => String(e.id || "").startsWith("seed-"));
  } catch {
    return true;
  }
}

export async function seedIfEmpty(patientId) {
  if (!patientId) return;
  try {
    const marker = await AsyncStorage.getItem(markerKey(patientId));
    if (marker === String(SEED_VERSION)) return; // already seeded at this version

    const factor = FACTOR[patientId] || 1;

    // Newest first, matching how every store is written.
    if (await replaceable(symptomKey(patientId))) {
      const entries = CHECK_INS.map((c, i) => {
        const at = stamp(c.hoursAgo);
        return {
          id: `seed-s-${i}`,
          by: c.by,
          scores: scoresFor(c.level, c.peak, factor),
          sleep: c.sleep,
          note: c.note,
          savedAt: at.at,
          hour: at.hour,
          timeLabel: at.timeLabel,
        };
      }).sort((a, b) => b.savedAt - a.savedAt);
      await AsyncStorage.setItem(symptomKey(patientId), JSON.stringify(entries));
    }

    if (await replaceable(mealKey(patientId))) {
      const entries = MEALS.map((m, i) => {
        const at = stamp(m.hoursAgo);
        return {
          id: `seed-m-${i}`,
          protein: m.protein,
          food: m.food,
          eatenAt: at.at,
          hour: at.hour,
          minuteOfDay: at.minuteOfDay,
          timeLabel: at.timeLabel,
        };
      }).sort((a, b) => b.eatenAt - a.eatenAt);
      await AsyncStorage.setItem(mealKey(patientId), JSON.stringify(entries));
    }

    if (await replaceable(doseKey(patientId))) {
      const entries = DOSES.map((d, i) => {
        const at = stamp(d.hoursAgo);
        return {
          id: `seed-d-${i}`,
          kind: d.kind,
          by: d.by,
          note: d.note,
          scheduledHour: d.scheduledHour,
          takenAt: at.at,
          hour: at.hour,
          minuteOfDay: at.minuteOfDay,
          timeLabel: at.timeLabel,
        };
      }).sort((a, b) => b.takenAt - a.takenAt);
      await AsyncStorage.setItem(doseKey(patientId), JSON.stringify(entries));
    }

    if (await replaceable(exerciseKey(patientId))) {
      const entries = EXERCISE.map((x, i) => {
        const at = stamp(x.hoursAgo);
        return {
          id: `seed-x-${i}`,
          activity: x.activity,
          level: x.level,
          minutes: x.minutes,
          by: "patient",
          doneAt: at.at,
          hour: at.hour,
          minuteOfDay: at.minuteOfDay,
          timeLabel: at.timeLabel,
        };
      }).sort((a, b) => b.doneAt - a.doneAt);
      await AsyncStorage.setItem(exerciseKey(patientId), JSON.stringify(entries));
    }

    await AsyncStorage.setItem(markerKey(patientId), String(SEED_VERSION));
  } catch {
    // Seeding is a convenience. If it fails the app still works, just empty.
  }
}
