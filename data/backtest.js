import { getHistory, rangeFor } from "./history";

// Walk-forward backtest of the off-period forecast.
//
// The question it answers is deliberately narrow: when the model said "N minutes
// until you drop below the therapeutic floor", how long did it actually take?
// Nothing else. No accuracy score invented out of thin air, just the gap between
// what was predicted and what happened, measured over every moment in the history
// where the model was willing to commit to a number.
//
// WHY THE FIT IS DUPLICATED HERE RATHER THAN IMPORTED
// forecastOff() in ./forecast reads getTodayTrend(), which slices midnight->now
// using the wall clock. That makes it untestable: the same call returns different
// points at 9am and 9pm, so a backtest built on it would produce a different
// number every time it ran and could never be reproduced or quoted. So the maths
// below is a copy of the same model — least squares on ln(level), the same 90
// minute window, the same MIN_POINTS floor, the same r-squared gate, the same
// refusal on a rising or flat trend — run against the fixed hourly getHistory
// data instead. Same model, deterministic input. If forecast.js changes its
// maths, these constants have to be changed to match or the backtest is
// validating a model that no longer ships.
const WINDOW_MINUTES = 90;
const MIN_POINTS = 4;
const MIN_FIT = 0.6;

// Beyond four hours the next dose has landed, so forecast.js stops showing a
// figure. A backtest of "when the model said N minutes" must not score numbers
// the model never actually said out loud.
const HORIZON_MINUTES = 240;

// Errors under this count as a hit. Half an hour is roughly the window in which
// a patient could still take a dose early and act on the warning usefully.
const HIT_MINUTES = 30;

const PATIENTS = ["robert", "margaret", "frank", "helen"];

// getHistory gives one reading per hour with day/hour/time/level but no absolute
// clock, so build a single monotonic minute axis across the whole history. Day
// labels are tracked in order of appearance rather than assuming 24 readings per
// day, so this survives the mock data changing length.
function toTimeline(readings) {
  const days = [];
  return readings.map((reading) => {
    if (!days.includes(reading.day)) days.push(reading.day);
    const dayIndex = days.indexOf(reading.day);
    return { ...reading, minute: dayIndex * 24 * 60 + reading.hour * 60 };
  });
}

// Least-squares fit of ln(level) against time. Identical to forecast.js.
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

  if (sxx === 0) return null;
  return {
    slope: sxy / sxx,
    r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy),
  };
}

// The forecast, expressed against an explicit list of past readings instead of
// the clock. `past` is the ONLY data this function can see, which is what makes
// the leakage guarantee checkable by reading one function.
// `floor` is the patient's own therapeutic low, passed in rather than read
// from a module constant: the window is per patient, so a backtest against a
// fixed 500 would be scoring a model the app no longer ships.
function predictFrom(past, floor) {
  const latest = past[past.length - 1];
  if (!latest) return { state: "unclear" };

  // Already under the floor is a current fact, not a forecast.
  if (latest.level <= floor) return { state: "already-low" };

  // Hourly mock readings are 60 minutes apart, so the 90 minute window holds
  // only two of them and the MIN_POINTS fallback does the real work here. Kept
  // in this shape anyway so the behaviour matches forecast.js exactly if the
  // sampling rate ever gets finer.
  const inWindow = past.filter((p) => latest.minute - p.minute <= WINDOW_MINUTES);
  const window =
    inWindow.length >= MIN_POINTS ? inWindow : past.slice(-MIN_POINTS);
  if (window.length < MIN_POINTS) return { state: "unclear" };

  const fit = fitLogLinear(window);
  if (!fit) return { state: "unclear" };
  if (fit.slope >= 0) return { state: "rising" }; // cannot extrapolate downwards
  if (fit.r2 < MIN_FIT) return { state: "unclear" }; // too scattered to trust

  const rate = -fit.slope;
  const minutes = Math.log(latest.level / floor) / rate;
  if (!isFinite(minutes) || minutes <= 0) return { state: "unclear" };

  return { state: "falling", minutes, fit: fit.r2, at: latest };
}

// When did the level ACTUALLY cross the floor, looking only forward from `from`?
//
// The readings are hourly but the crossing happens somewhere between two of
// them, so interpolate. The interpolation is log-linear to match the decay the
// model assumes; snapping to the next whole hour instead would add up to 60
// minutes of quantisation error that belongs to the sampling rate, not the model,
// and would make the model look worse than it is.
function actualCrossing(readings, from, anchorMinute, floor) {
  for (let j = from; j < readings.length; j++) {
    if (readings[j].level > floor) continue;

    const next = readings[j];
    const prev = readings[j - 1]; // always above the floor: j is the first below
    const lnPrev = Math.log(Math.max(prev.level, 1));
    const lnNext = Math.log(Math.max(next.level, 1));
    const lnFloor = Math.log(floor);
    const span = lnPrev - lnNext;
    const fraction = span === 0 ? 0 : (lnPrev - lnFloor) / span;
    const crossMinute = prev.minute + fraction * (next.minute - prev.minute);

    return { minutes: crossMinute - anchorMinute, index: j };
  }
  return null; // history runs out before the level ever falls through
}

export function backtestPatient(patientId) {
  const readings = toTimeline(getHistory(patientId));
  const { low: floor } = rangeFor(patientId);

  const steps = [];
  const declined = { rising: 0, unclear: 0, alreadyLow: 0, beyondHorizon: 0 };
  let noCrossingAhead = 0;

  // i is an exclusive upper bound: everything before it is the past, everything
  // from it onwards is the future.
  for (let i = MIN_POINTS; i < readings.length; i++) {
    // NO FUTURE LEAKAGE. The forecast is handed readings.slice(0, i) and nothing
    // else — it physically cannot see readings[i] or anything after it. This is
    // the whole point of the file. A backtest that fits on the full array, or
    // that peeks at the crossing before predicting, reports an error of near
    // zero and means absolutely nothing: it is measuring how well a line fits
    // points it was already shown. Every future value below is read only after
    // the prediction exists and only to score it.
    const past = readings.slice(0, i);
    const forecast = predictFrom(past, floor);

    if (forecast.state !== "falling") {
      declined[forecast.state === "already-low" ? "alreadyLow" : forecast.state]++;
      continue;
    }

    // The model refuses to name a figure this far out, so scoring one would be
    // scoring something it never said.
    if (forecast.minutes >= HORIZON_MINUTES) {
      declined.beyondHorizon++;
      continue;
    }

    const anchor = past[past.length - 1];
    const crossing = actualCrossing(readings, i, anchor.minute, floor);
    if (crossing === null) {
      // Counted, not silently dropped: a run of these means the tail of the
      // history never goes off, which is a fact about the data.
      noCrossingAhead++;
      continue;
    }

    // Did a dose land between the forecast and the actual crossing? The model
    // only extrapolates the current decay; it knows nothing about the dosing
    // schedule, so a dose arriving first pushes the real off-period hours out
    // and the error explodes through no fault of the fit. Recorded, never
    // filtered — dropping these would flatter the model. It is here so a reader
    // can tell "the fit was wrong" apart from "a dose intervened", which are
    // two completely different problems with two different fixes.
    const doseIntervened = readings
      .slice(i, crossing.index)
      .some((r) => r.level > anchor.level);

    const error = Math.abs(forecast.minutes - crossing.minutes);
    steps.push({
      day: anchor.day,
      time: anchor.time,
      level: anchor.level,
      predicted: Math.round(forecast.minutes),
      actual: Math.round(crossing.minutes),
      error: Math.round(error),
      fit: Number(forecast.fit.toFixed(3)),
      doseIntervened,
    });
  }

  return {
    patientId,
    ...summarise(steps),
    declined: total(declined),
    declinedReasons: declined,
    noCrossingAhead,
    steps, // also lets backtestAll pool raw steps rather than average medians
  };
}

export function backtestAll() {
  const patients = PATIENTS.map(backtestPatient);

  // Pool every individual prediction and take one median over the lot. Averaging
  // the four per-patient medians would weight a patient with three predictions
  // the same as one with twenty.
  const pooled = patients.flatMap((p) => p.steps);

  return {
    patients,
    overall: {
      ...summarise(pooled),
      declined: sum(patients.map((p) => p.declined)),
      noCrossingAhead: sum(patients.map((p) => p.noCrossingAhead)),
    },
  };
}

// Median, not mean: one dose landing mid-forecast produces a single enormous
// error, and a mean would let that one step dominate the headline figure in
// either direction. The median says what a typical forecast was worth.
function summarise(steps) {
  const errors = steps.map((s) => s.error);
  const clean = steps.filter((s) => !s.doseIntervened).map((s) => s.error);

  return {
    predictions: errors.length,
    medianAbsError: errors.length ? Math.round(median(errors)) : null,
    within30: errors.length
      ? errors.filter((e) => e < HIT_MINUTES).length / errors.length
      : null,
    // The same figures over only the forecasts a dose did not interrupt. Not the
    // headline — the headline stays the honest all-in number — but the pair
    // together say whether the model or the dosing schedule is the problem.
    doseIntervened: errors.length - clean.length,
    medianAbsErrorNoDose: clean.length ? Math.round(median(clean)) : null,
    within30NoDose: clean.length
      ? clean.filter((e) => e < HIT_MINUTES).length / clean.length
      : null,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function total(counts) {
  return sum(Object.values(counts));
}

// One line, plain words, no jargon — printable to a console or readable off a
// slide without the reader knowing what r-squared is.
export function formatBacktest(result) {
  const s = result.overall || result;
  if (!s.predictions) return "No forecasts to score.";

  const lines = [
    `Median error ${s.medianAbsError} min across ${s.predictions} forecasts, ` +
      `${Math.round(s.within30 * 100)}% within ${HIT_MINUTES} min.`,
  ];

  // Only worth a second line when doses actually got in the way.
  if (s.doseIntervened && s.medianAbsErrorNoDose !== null) {
    lines.push(
      `Excluding the ${s.doseIntervened} forecasts a dose interrupted: ` +
        `median error ${s.medianAbsErrorNoDose} min, ` +
        `${Math.round(s.within30NoDose * 100)}% within ${HIT_MINUTES} min.`
    );
  }

  lines.push(
    `${s.declined} steps declined a prediction, ` +
      `${s.noCrossingAhead} had no off-period ahead to score against.`
  );

  return lines.join("\n");
}
