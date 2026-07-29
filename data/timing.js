import { RANGE_HIGH, RANGE_LOW, getTodayTrend } from "./history";

// Matches an event's start time against the patient's own levels at that hour.
//
// This is the part no generic events list can do: the app already knows when
// this person tends to be "on", so it can say whether a 7am class is realistic
// for them. It reports a pattern and never tells anyone to move a dose.
export function timingFor(patientId, startHour) {
  if (typeof startHour !== "number") return null;

  const trend = getTodayTrend(patientId);
  // Each point carries the minute of day it represents, so find the reading
  // closest to the event's start hour.
  const targetMinute = startHour * 60;
  const nearest = trend.reduce((best, point) =>
    Math.abs(point.minute - targetMinute) < Math.abs(best.minute - targetMinute)
      ? point
      : best
  );

  const level = nearest.level;

  if (level >= RANGE_LOW && level <= RANGE_HIGH) {
    return {
      fit: "good",
      label: "Good time — your levels are usually in range",
      detail: `Around ${level} ng/mL at this hour`,
    };
  }
  if (level < RANGE_LOW) {
    return {
      fit: "poor",
      label: "Your levels are often low at this hour",
      detail: `Around ${level} ng/mL — you may find this harder`,
    };
  }
  return {
    fit: "high",
    label: "Your levels are often above range at this hour",
    detail: `Around ${level} ng/mL at this hour`,
  };
}
