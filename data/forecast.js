import { RANGE_LOW, getTodayTrend } from "./history";

// Estimates when the level will fall through the therapeutic floor.
//
// Levodopa clears roughly exponentially after a dose peaks, so ln(level) falls
// in a straight line against time. Fitting that line gives the clearance rate,
// and solving it for the floor gives the time remaining.
//
// It fits over a WINDOW rather than the last two readings. That matters for a
// real sensor: consecutive readings a minute apart differ mostly by noise, and
// dividing a noisy difference by a small time interval amplifies it — the
// estimate would swing wildly between readings. A least-squares fit over ~90
// minutes averages the noise out, and the fit quality (r²) gives an honest
// signal for when the data is too messy to say anything at all.
const WINDOW_MINUTES = 90;
const MIN_POINTS = 4;
const MIN_FIT = 0.6; // below this the readings are too scattered to trust

export function forecastOff(patientId) {
  const points = getTodayTrend(patientId);
  const latest = points[points.length - 1];
  if (!latest) return { state: "unclear" };

  // Already below the floor is a current fact, not a forecast.
  if (latest.level <= RANGE_LOW) {
    return { state: "already-low", level: latest.level };
  }

  // Prefer everything inside the time window — with a real sensor reporting
  // every minute or two that is plenty of points. But readings can be spaced
  // further apart than the window, so fall back to the last few regardless of
  // span rather than refusing to answer.
  const inWindow = points.filter(
    (p) => latest.minute - p.minute <= WINDOW_MINUTES
  );
  const window =
    inWindow.length >= MIN_POINTS ? inWindow : points.slice(-MIN_POINTS);
  if (window.length < MIN_POINTS) return { state: "unclear" };

  const fit = fitLogLinear(window);
  if (!fit) return { state: "unclear" };

  // A rising or flat level cannot be extrapolated downwards.
  if (fit.slope >= 0) return { state: "rising", level: latest.level };

  // Say nothing rather than guess when the trend is not clean.
  if (fit.r2 < MIN_FIT) return { state: "unclear", level: latest.level };

  const rate = -fit.slope; // clearance per minute
  const minutes = Math.log(latest.level / RANGE_LOW) / rate;
  if (!isFinite(minutes) || minutes <= 0) return { state: "unclear" };

  // A point estimate would imply precision the fit does not have, so widen it
  // as confidence drops.
  const spread = Math.max(0.15, 1 - fit.r2);

  return {
    state: "falling",
    level: latest.level,
    minutes: Math.round(minutes),
    low: Math.round(minutes * (1 - spread)),
    high: Math.round(minutes * (1 + spread)),
    fit: fit.r2,
    // Beyond about four hours the next dose will have landed, so any figure is
    // fiction.
    confident: minutes < 240,
  };
}

// Least-squares fit of ln(level) against time, returning the slope and how well
// the line actually describes the points.
function fitLogLinear(points) {
  const n = points.length;
  const xs = points.map((p) => p.minute);
  const ys = points.map((p) => Math.log(Math.max(p.level, 1)));

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  if (sxx === 0) return null; // every reading at the same instant
  return {
    slope: sxy / sxx,
    r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy),
  };
}

// A bare duration, with no hedging word attached — the caller decides whether
// to say "about", "to", or nothing, so the two never collide.
function duration(minutes) {
  if (minutes < 90) {
    const rounded = Math.max(10, Math.round(minutes / 10) * 10);
    return `${rounded} minutes`;
  }
  const hours = Math.round(minutes / 30) / 2;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

// Anything sooner than this is reported as a bound rather than a figure — at
// that range the estimate cannot be more precise than "very soon".
const IMMINENT_MINUTES = 20;

function headlineFor(forecast) {
  if (forecast.minutes < IMMINENT_MINUTES) return "Less than 20 minutes";

  const spread = forecast.high - forecast.low;
  const sameWords = duration(forecast.low) === duration(forecast.high);
  if (spread > 5 && !sameWords) {
    return `${duration(forecast.low)} to ${duration(forecast.high)}`;
  }
  return `About ${duration(forecast.minutes)}`;
}

export function describeForecast(forecast) {
  switch (forecast.state) {
    case "falling":
      return forecast.confident
        ? {
            // A range, because the fit supports a range and not a single number.
            headline: headlineFor(forecast),
            detail:
              "until your level is likely to drop below the usual range.",
            tone: "warn",
          }
        : {
            headline: "Easing down slowly",
            detail:
              "Your level is falling, but not soon enough to estimate a time.",
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
