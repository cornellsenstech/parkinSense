import { RANGE_HIGH, RANGE_LOW, getHistory } from "./history";

// Matches an event's start time against the patient's own levels at that hour.
//
// This is the part no generic events list can do: the app already knows when
// this person tends to be "on", so it can say whether a 7am class is realistic
// for them. It reports a pattern and never tells anyone to move a dose.
//
// Deliberately reads the fixed hourly history rather than the day-so-far trend.
// That trend splits midnight-to-now into 24 segments, so its resolution — and
// therefore its estimate for a given hour — shifts as the day goes on. A
// verdict about 7am should not change depending on when you look at it.
export function timingFor(patientId, startHour) {
  if (typeof startHour !== "number") return null;

  // Every reading recorded at this hour, across the days we have.
  const atHour = getHistory(patientId).filter((r) => r.hour === startHour);
  if (!atHour.length) return null;

  const level = Math.round(
    atHour.reduce((sum, r) => sum + r.level, 0) / atHour.length
  );

  if (level >= RANGE_LOW && level <= RANGE_HIGH) {
    return {
      fit: "good",
      label: "Good time — your levels are usually in range",
      detail: `Usually around ${level} ng/mL at this hour`,
    };
  }
  if (level < RANGE_LOW) {
    return {
      fit: "poor",
      label: "Your levels are often low at this hour",
      detail: `Usually around ${level} ng/mL — you may find this harder`,
    };
  }
  return {
    fit: "high",
    label: "Your levels are often above range at this hour",
    detail: `Usually around ${level} ng/mL at this hour`,
  };
}
