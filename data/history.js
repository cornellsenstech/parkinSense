// Mock 24-hour levodopa history (one reading per hour), in ng/mL.
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

export function getHistory(patientId) {
  const factor = FACTOR[patientId] || 1;
  return BASE.map((value, hour) => ({
    label: `${String(hour).padStart(2, "0")}:00`,
    level: Math.round(value * factor),
  }));
}

// Therapeutic window for levodopa is 500-1500 ng/mL.
// Research: optimum response is ~300-1600 ng/mL and effective oral levels are
// ~400-1200. Only 200-400 ng/mL separates the "off" state from the "on" state.
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC1401168/
//   https://pmc.ncbi.nlm.nih.gov/articles/PMC9686322/
export function levelTone(level) {
  if (level < 500) return { color: "#2563eb", label: "Low" };
  if (level > 1500) return { color: "#dc2626", label: "High" };
  return { color: "#16a34a", label: "In range" };
}
