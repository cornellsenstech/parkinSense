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

// Symptom check-ins the patient saved, newest first.
export function getSymptomLog(patientId) {
  const factor = FACTOR[patientId] || 1;
  const severity = factor > 1.1 || factor < 0.8 ? 3 : 1; // worse outside the window
  return [
    { id: "s1", day: DAYS[1], time: "8:00 PM", stiffness: severity, tremor: severity + 1 },
    { id: "s2", day: DAYS[1], time: "9:00 AM", stiffness: severity, tremor: severity },
    { id: "s3", day: DAYS[0], time: "7:00 PM", stiffness: severity + 1, tremor: severity },
    { id: "s4", day: DAYS[0], time: "8:00 AM", stiffness: severity, tremor: severity },
  ].map((entry) => ({
    ...entry,
    stiffness: Math.min(4, entry.stiffness),
    tremor: Math.min(4, entry.tremor),
  }));
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
