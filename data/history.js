import { patients } from "./patients";

// Mock levodopa history, in ng/mL. One reading per hour across two days.
// Shaped like a real dosing day: an overnight trough that drops below the
// therapeutic floor, then three doses that each peak and decay.
const BASE = [
  420, 380, 340, 310, 290, 270, 250, // 00:00–06:00 overnight decay
  520, 1180, 1420, 1250, 900, 640, // 07:00 dose, peak, decay
  1310, 1480, 1220, 880, 610, // 13:00 dose, peak, decay
  1350, 1560, 1280, 950, 700, 520, // 18:00 dose, peak, decay
];

// The dosing schedule the curve above is built around. Exported so the meal log
// can work out whether a meal lands close to a dose.
export const DOSE_HOURS = [7, 13, 18];

// Each patient absorbs differently, so scale the whole curve.
const FACTOR = { robert: 1, margaret: 0.65, frank: 0.9, helen: 1.25 };

const DAYS = ["Monday, Feb 16", "Tuesday, Feb 17"];

// Newest last, so the chart reads left to right through time.
export function getHistory(patientId) {
  const factor = FACTOR[patientId] || 1;
  const readings = [];

  DAYS.forEach((day, dayIndex) => {
    BASE.forEach((value, hour) => {
      readings.push({
        id: `${dayIndex}-${hour}`,
        day,
        shortDay: day.split(",")[1].trim(),
        hour, // 0-23, so callers can match a clock time without parsing
        time: formatTime(hour),
        level: Math.round(value * factor * (dayIndex === 0 ? 0.93 : 1)),
      });
    });
  });

  return readings;
}

function formatTime(hour) {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${suffix}`;
}

// Splits midnight -> now into exactly 24 segments, whatever the time of day.
// A fixed segment count keeps the shape of the day comparable at 9am and 9pm,
// instead of the chart stretching as hours accumulate.
export function getTodayTrend(patientId, now = new Date()) {
  const factor = FACTOR[patientId] || 1;
  const minutesSoFar = now.getHours() * 60 + now.getMinutes();
  const perSegment = Math.max(minutesSoFar / 24, 1); // guard just after midnight

  const points = [];
  for (let i = 0; i < 24; i++) {
    const minute = perSegment * (i + 1);
    points.push({
      minute,
      label: clockLabel(minute),
      level: Math.round(levelAtMinute(minute) * factor),
    });
  }
  return points;
}

// Reads the hourly curve, interpolating between the two nearest hours so a
// segment boundary that lands mid-hour still gets a sensible value.
function levelAtMinute(minute) {
  const hour = minute / 60;
  const index = Math.min(Math.floor(hour), BASE.length - 1);
  const next = Math.min(index + 1, BASE.length - 1);
  const fraction = hour - index;
  return BASE[index] + (BASE[next] - BASE[index]) * fraction;
}

function clockLabel(minute) {
  const h24 = Math.floor(minute / 60) % 24;
  const mins = Math.round(minute % 60);
  const suffix = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mins).padStart(2, "0")} ${suffix}`;
}

// One plain sentence describing the day, derived from the data rather than
// hardcoded — so it stays true and can be read aloud later.
export function describeTrend(points, patientId) {
  if (!points.length) return "";
  const { low, high } = rangeFor(patientId);
  const last = points[points.length - 1].level;
  const previous = points.length > 1 ? points[points.length - 2].level : last;
  const inRange = points.filter((p) => p.level >= low && p.level <= high).length;
  const percent = Math.round((inRange / points.length) * 100);
  const direction = last > previous ? "rising" : last < previous ? "falling" : "steady";
  return `Now ${last} ng/mL and ${direction}. ${percent}% of today has been in range.`;
}

// Which way the day is heading right now. Split out of describeTrend because the
// dyskinesia check needs the direction on its own, not inside a sentence.
export function trendDirection(points) {
  if (points.length < 2) return "steady";
  const last = points[points.length - 1].level;
  const previous = points[points.length - 2].level;
  if (last > previous) return "rising";
  if (last < previous) return "falling";
  return "steady";
}

// Symptom check-ins, one every four hours, oldest first.
//
// Severity is derived from the level at that moment rather than random: real
// symptoms track the therapeutic window, so a patient reports stiffness and
// tremor when their level has drifted out of it. That correlation is the whole
// clinical point of the device, so the mock data should show it.
export function getSymptomLog(patientId) {
  return getHistory(patientId)
    .filter((reading, i) => i % 4 === 0)
    .map((reading) => {
      const below = reading.level < RANGE_LOW;
      const above = reading.level > RANGE_HIGH;
      const severity = below ? 3 : above ? 2 : 0;

      return {
        id: `s-${reading.id}`,
        day: reading.day,
        time: reading.time,
        level: reading.level,
        // Tremor runs a little worse than stiffness when the level is low.
        stiffness: severity,
        tremor: Math.min(4, below ? severity + 1 : severity),
      };
    });
}

// Default therapeutic window for levodopa, 500-1500 ng/mL.
// Research: optimum response is ~300-1600 ng/mL and effective oral levels are
// ~400-1200. Only 200-400 ng/mL separates the "off" state from the "on" state.
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC1401168/
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC9686322/
//
// These stay exported as the fallback, but the window is really per patient —
// it narrows with disease duration and with dyskinesia. Prefer rangeFor().
export const RANGE_LOW = 500;
export const RANGE_HIGH = 1500;
export const CHART_MAX = 2000;

// Per-patient window, falling back to the default when a patient has none set.
export function rangeFor(patientId) {
  const patient = patients.find((p) => p.id === patientId);
  return {
    low: patient?.rangeLow ?? RANGE_LOW,
    high: patient?.rangeHigh ?? RANGE_HIGH,
  };
}

export function levelTone(level, patientId) {
  const { low, high } = rangeFor(patientId);
  if (level < low) return { color: "#2563eb", label: "Low" };
  if (level > high) return { color: "#dc2626", label: "High" };
  return { color: "#16a34a", label: "In range" };
}

// Where extra movements are plausible.
//
// It is not simply "high level". Peak-dose dyskinesia happens near the top of
// the window, but diphasic dyskinesia happens while the level is CLIMBING into
// or FALLING out of the window — that is, at low readings. Flagging only the
// high end would tell a patient their extra movements are impossible when they
// are in fact well described.
//
// `direction` is "rising", "falling" or "steady".
export function dyskinesiaRisk(level, patientId, direction = "steady") {
  const { low, high } = rangeFor(patientId);

  if (level > high) {
    return {
      risk: true,
      kind: "peak",
      note: "Extra movements are most likely near the top of your range.",
    };
  }

  // The transition band: the lower part of the window and just below it, but
  // only while the level is actually moving through it.
  const movingThroughLow = level < low * 1.3 && direction !== "steady";
  if (movingThroughLow) {
    return {
      risk: true,
      kind: "diphasic",
      note:
        direction === "rising"
          ? "Extra movements can also happen as your level climbs, before it reaches your range."
          : "Extra movements can also happen as your level drops out of your range, not only when it is high.",
    };
  }

  return { risk: false, kind: null, note: null };
}
