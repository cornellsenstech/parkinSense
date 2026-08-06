import { doseSummary } from "./doseLog";
import { exerciseSummary } from "./exerciseLog";
import { rangeFor } from "./history";
import { doseProximity } from "./mealLog";
import { SYMPTOMS, migrateScores } from "./symptoms";

// The weekly view a clinician asks for: a mean, a direction of travel, and the
// two or three things worth looking at.
//
// Two rolling seven-day windows rather than calendar weeks, because a Tuesday
// appointment should compare the last seven days with the seven before them,
// not with a part-finished calendar week.
//
// Everything here is derived. Nothing is stored, so a summary can never drift
// out of step with the entries it describes.
const DAY = 24 * 60 * 60 * 1000;

function windowOf(entries, stampKey, from, to) {
  return entries.filter((e) => e[stampKey] >= from && e[stampKey] < to);
}

function meanScore(entries, symptomId) {
  if (!entries.length) return null;
  const total = entries.reduce((sum, e) => {
    const scores = migrateScores(e.scores);
    return sum + (scores[symptomId] ?? 0);
  }, 0);
  return total / entries.length;
}

// The average across every symptom, which is what the doctor chart plots as
// "average of all". Kept here too so the number under the chart and the number
// in the summary come from one place.
function meanOverall(entries) {
  if (!entries.length) return null;
  const perEntry = entries.map((e) => {
    const scores = migrateScores(e.scores);
    const values = SYMPTOMS.map((s) => scores[s.id] ?? 0);
    return values.reduce((a, b) => a + b, 0) / values.length;
  });
  return perEntry.reduce((a, b) => a + b, 0) / perEntry.length;
}

function round1(value) {
  return value == null ? null : Math.round(value * 10) / 10;
}

export function weeklySummary({
  patientId,
  readings = [],
  checkIns = [],
  meals = [],
  doses = [],
  exercise = [],
  now = Date.now(),
}) {
  const thisFrom = now - 7 * DAY;
  const prevFrom = now - 14 * DAY;

  const thisWeek = windowOf(checkIns, "savedAt", thisFrom, now);
  const prevWeek = windowOf(checkIns, "savedAt", prevFrom, thisFrom);

  const overallNow = meanOverall(thisWeek);
  const overallPrev = meanOverall(prevWeek);

  // Per-symptom movement, so "notable points" names a symptom rather than
  // reporting that things are generally a bit worse.
  const movers = SYMPTOMS.map((s) => {
    const current = meanScore(thisWeek, s.id);
    const previous = meanScore(prevWeek, s.id);
    return {
      id: s.id,
      label: s.label,
      colour: s.colour,
      mean: round1(current),
      previous: round1(previous),
      change: current != null && previous != null ? current - previous : null,
    };
  }).filter((m) => m.mean != null);

  const worsening = movers
    .filter((m) => m.change != null && m.change >= 0.4)
    .sort((a, b) => b.change - a.change);
  const improving = movers
    .filter((m) => m.change != null && m.change <= -0.4)
    .sort((a, b) => a.change - b.change);
  const worst = [...movers].sort((a, b) => b.mean - a.mean)[0] || null;

  // Levels. The mock sensor history is only two days long, so this reports the
  // window it actually has rather than pretending to a week of readings.
  const { low, high } = rangeFor(patientId);
  const levels = readings.map((r) => r.level);
  const inRange = readings.filter((r) => r.level >= low && r.level <= high);
  const levelStats = levels.length
    ? {
        mean: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
        min: Math.min(...levels),
        max: Math.max(...levels),
        percentInRange: Math.round((inRange.length / readings.length) * 100),
        hours: readings.length,
        low,
        high,
      }
    : null;

  const doseStats = doseSummary(doses, 7, now);
  const exerciseStats = exerciseSummary(exercise, 7, now);

  const mealsThisWeek = windowOf(meals, "eatenAt", thisFrom, now);
  const clashes = mealsThisWeek.filter((m) => doseProximity(m)?.flag).length;

  return {
    checkIns: thisWeek.length,
    previousCheckIns: prevWeek.length,
    overall: round1(overallNow),
    overallPrevious: round1(overallPrev),
    overallChange:
      overallNow != null && overallPrev != null
        ? round1(overallNow - overallPrev)
        : null,
    movers,
    worsening,
    improving,
    worst,
    levels: levelStats,
    doses: doseStats,
    exercise: exerciseStats,
    proteinClashes: clashes,
    meals: mealsThisWeek.length,
  };
}

// The notable points, as sentences. Ordered by what would change a decision:
// missed doses first, then a symptom that has clearly moved, then the softer
// context. Returns an empty list rather than inventing filler when a week is
// genuinely unremarkable — a summary that always finds something to say stops
// being read.
export function notablePoints(summary) {
  const points = [];
  if (!summary) return points;

  if (summary.doses.missed > 0) {
    points.push({
      tone: "warn",
      text:
        summary.doses.missed === 1
          ? "One scheduled dose was logged as missed this week."
          : `${summary.doses.missed} scheduled doses were logged as missed this week.`,
    });
  }

  if (summary.doses.rescue > 0) {
    points.push({
      tone: "warn",
      text: `${summary.doses.rescue} extra ${
        summary.doses.rescue === 1 ? "dose" : "doses"
      } taken outside the schedule, which usually means off periods are breaking through.`,
    });
  }

  summary.worsening.slice(0, 2).forEach((m) => {
    points.push({
      tone: "warn",
      text: `${m.label} is up from ${m.previous} to ${m.mean} out of 4 compared with the week before.`,
    });
  });

  summary.improving.slice(0, 1).forEach((m) => {
    points.push({
      tone: "good",
      text: `${m.label} is down from ${m.previous} to ${m.mean} out of 4.`,
    });
  });

  if (summary.proteinClashes > 0) {
    points.push({
      tone: "note",
      text: `${summary.proteinClashes} high-protein ${
        summary.proteinClashes === 1 ? "meal" : "meals"
      } fell within an hour of a dose.`,
    });
  }

  if (summary.exercise.activeDays > 0) {
    points.push({
      tone: summary.exercise.activeDays >= 4 ? "good" : "note",
      text: `Active on ${summary.exercise.activeDays} of 7 days, ${summary.exercise.totalMinutes} minutes in total.`,
    });
  }

  if (summary.checkIns === 0) {
    points.push({
      tone: "note",
      text: "No check-ins were recorded this week, so the symptom figures are unavailable.",
    });
  }

  return points;
}
