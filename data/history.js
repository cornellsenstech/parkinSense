// Mock levodopa history, in ng/mL. One reading per hour across two days.
// Shaped like a real dosing day: an overnight trough that drops below the
// therapeutic floor, then three doses that each peak and decay.
const BASE = [
  420, 380, 340, 310, 290, 270, 250, // 00:00–06:00 overnight decay
  520, 1180, 1420, 1250, 900, 640, // 07:00 dose, peak, decay
  1310, 1480, 1220, 880, 610, // 13:00 dose, peak, decay
  1350, 1560, 1280, 950, 700, 520, // 18:00 dose, peak, decay
];

// Each patient absorbs differently, so scale the whole curve.
const FACTOR = { kermit: 1, piggy: 0.65, fozzie: 0.9, gonzo: 1.25 };

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
export function describeTrend(points) {
  if (!points.length) return "";
  const last = points[points.length - 1].level;
  const previous = points.length > 1 ? points[points.length - 2].level : last;
  const inRange = points.filter(
    (p) => p.level >= RANGE_LOW && p.level <= RANGE_HIGH
  ).length;
  const percent = Math.round((inRange / points.length) * 100);
  const direction = last > previous ? "rising" : last < previous ? "falling" : "steady";
  return `Now ${last} ng/mL and ${direction}. ${percent}% of today has been in range.`;
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

// Therapeutic window for levodopa is 500-1500 ng/mL.
// Research: optimum response is ~300-1600 ng/mL and effective oral levels are
// ~400-1200. Only 200-400 ng/mL separates the "off" state from the "on" state.
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC1401168/
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC9686322/
export const RANGE_LOW = 500;
export const RANGE_HIGH = 1500;
export const CHART_MAX = 2000;

export function levelTone(level) {
  if (level < RANGE_LOW) return { color: "#2563eb", label: "Low" };
  if (level > RANGE_HIGH) return { color: "#dc2626", label: "High" };
  return { color: "#16a34a", label: "In range" };
}
