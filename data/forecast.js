import { RANGE_LOW, getTodayTrend } from "./history";

// Estimates when the level will fall through the therapeutic floor.
//
// After a dose peaks, levodopa clears roughly exponentially: L(t) = L0 * e^(-k*t).
// Two readings on the falling limb are enough to estimate k, and the same
// equation inverted gives the time at which the curve reaches the floor.
//
// It refuses to answer in every case where an answer would be invented — a
// rising curve, a flat pair, or a level already below the floor. Saying nothing
// is better than showing a number with no basis.
export function forecastOff(patientId) {
  const points = getTodayTrend(patientId);
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];

  if (!latest || !previous) return { state: "unclear" };

  // Already below the floor is a current fact, not a forecast.
  if (latest.level <= RANGE_LOW) {
    return { state: "already-low", level: latest.level };
  }

  // Extrapolating a rising curve downwards is meaningless.
  if (latest.level >= previous.level) {
    return { state: "rising", level: latest.level };
  }

  const minutes = latest.minute - previous.minute;
  if (minutes <= 0) return { state: "unclear" };

  // The decay constant, from the two-point form of the exponential.
  const k = Math.log(previous.level / latest.level) / minutes;
  // Guards the division below: equal readings give k = 0 and Infinity minutes.
  if (!isFinite(k) || k <= 0) return { state: "unclear" };

  const minutesToFloor = Math.log(latest.level / RANGE_LOW) / k;
  if (!isFinite(minutesToFloor) || minutesToFloor <= 0) {
    return { state: "unclear" };
  }

  return {
    state: "falling",
    level: latest.level,
    minutes: Math.round(minutesToFloor),
    // Beyond about four hours the next dose will have landed, so a precise
    // number would be fiction.
    confident: minutesToFloor < 240,
  };
}

// Rounds to something a person would actually say out loud.
function roughly(minutes) {
  if (minutes < 20) return "less than 20 minutes";
  if (minutes < 90) return `about ${Math.round(minutes / 10) * 10} minutes`;
  const hours = Math.round(minutes / 30) / 2;
  return `about ${hours} hours`;
}

export function describeForecast(forecast) {
  switch (forecast.state) {
    case "falling":
      return forecast.confident
        ? {
            headline: roughly(forecast.minutes),
            detail: "until your level is likely to drop below the usual range.",
            tone: "warn",
          }
        : {
            headline: "Easing down slowly",
            detail: "Your level is falling, but not soon enough to estimate a time.",
            tone: "calm",
          };
    case "rising":
      return {
        headline: "Climbing",
        detail: "Your level is going up after a dose, so nothing to flag yet.",
        tone: "good",
      };
    case "already-low":
      return {
        headline: "Below range now",
        detail: `Your level is around ${forecast.level} ng/mL, under the usual range.`,
        tone: "warn",
      };
    default:
      return null; // nothing sensible to say, so the card hides itself
  }
}
