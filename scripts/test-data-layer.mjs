// Tests for the pure functions in data/.
//
//   node scripts/test-data-layer.mjs
//
// These modules import React Native, so they cannot be loaded under plain node.
// The sources are read, their import/export keywords stripped, concatenated in
// dependency order and evaluated as one module — the same trick the backtest
// script uses. It means these tests exercise the code that actually ships
// rather than a copy that can drift out of step with it.
//
// Only pure functions are covered. Anything touching AsyncStorage, the clock or
// the DOM belongs in the browser, not here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Several stores each declare a module-private `keyFor`. That is correct in
// their own files and collides once they share one scope here, so private
// helpers are given a per-file suffix. Only names that are genuinely local to a
// module are renamed; anything the tests import keeps its real name.
const PRIVATE = ["keyFor"];

const strip = (file) => {
  let src = fs
    .readFileSync(path.join(root, "data", file), "utf8")
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^export\s+/gm, "");

  const suffix = "_" + file.replace(/\W/g, "_");
  for (const name of PRIVATE) {
    // Word boundary written as an escaped backslash inside the template, not a
    // bare \b — which is a backspace character and would match nothing. This is
    // the same escape trap that silently disabled every safety regex in
    // data/assistant.js; see scripts/test-assistant-boundary.mjs.
    src = src.replace(new RegExp("\\b" + name + "\\b", "g"), name + suffix);
  }
  return src;
};

const source = [
  strip("patients.js"),
  strip("history.js"),
  strip("symptoms.js"),
  strip("forecast.js"),
  strip("doseLog.js"),
  strip("exerciseLog.js"),
].join("\n");

const M = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      source +
        "\nexport { rangeFor, levelTone, dyskinesiaRisk, trendDirection, " +
        "solveOffPeriod, nextDoseIn, fitLogLinear, migrateScores, emptyScores, " +
        "SYMPTOMS, doseSummary, doseSchedule, exerciseSummary };"
    ).toString("base64")
);

let failures = 0;
let checks = 0;
let group = "";

const describe = (name) => {
  group = name;
  console.log(`\n${name}`);
};

const ok = (label, condition, detail = "") => {
  checks++;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const eq = (label, actual, expected) =>
  ok(label, actual === expected, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

const near = (label, actual, expected, tolerance) =>
  ok(
    label,
    Math.abs(actual - expected) <= tolerance,
    `got ${actual}, want ${expected} ±${tolerance}`
  );

// ---------------------------------------------------------------------------
describe("Therapeutic window is per patient");
eq("robert low", M.rangeFor("robert").low, 500);
eq("helen is the narrowest", M.rangeFor("helen").high, 1250);
eq("margaret has the lowest floor", M.rangeFor("margaret").low, 450);
eq("unknown patient falls back to the default", M.rangeFor("nobody").low, 500);
ok(
  "every patient's floor is below their ceiling",
  ["robert", "margaret", "frank", "helen"].every(
    (p) => M.rangeFor(p).low < M.rangeFor(p).high
  )
);

describe("levelTone judges against the patient's own window");
eq("1300 is in range for robert", M.levelTone(1300, "robert").label, "In range");
eq("1300 is high for helen", M.levelTone(1300, "helen").label, "High");
eq("470 is low for robert", M.levelTone(470, "robert").label, "Low");
eq("470 is in range for margaret", M.levelTone(470, "margaret").label, "In range");

describe("Dyskinesia risk covers both ends, not just the top");
ok("above the ceiling flags peak-dose", M.dyskinesiaRisk(1600, "robert", "steady").risk);
eq("and names it", M.dyskinesiaRisk(1600, "robert", "steady").kind, "peak");
ok(
  "a low level while falling flags diphasic",
  M.dyskinesiaRisk(560, "robert", "falling").risk
);
eq(
  "and names that too",
  M.dyskinesiaRisk(560, "robert", "falling").kind,
  "diphasic"
);
ok(
  "a low level while steady does not flag",
  !M.dyskinesiaRisk(560, "robert", "steady").risk
);
ok(
  "mid-range and steady does not flag",
  !M.dyskinesiaRisk(1000, "robert", "steady").risk
);

describe("trendDirection");
eq("rising", M.trendDirection([{ level: 100 }, { level: 200 }]), "rising");
eq("falling", M.trendDirection([{ level: 200 }, { level: 100 }]), "falling");
eq("flat", M.trendDirection([{ level: 100 }, { level: 100 }]), "steady");
eq("a single point cannot have a direction", M.trendDirection([{ level: 100 }]), "steady");

// ---------------------------------------------------------------------------
// A clean exponential decay with a known half-life, so the expected answer can
// be computed by hand rather than taken from the implementation.
const decay = (start, ratePerMin, minutes) =>
  Array.from({ length: minutes }, (_, i) => ({
    minute: i * 10,
    level: start * Math.exp(-ratePerMin * i * 10),
  }));

describe("fitLogLinear recovers a known decay rate");
{
  const fit = M.fitLogLinear(decay(1500, 0.004, 12));
  near("slope is the negative rate", fit.slope, -0.004, 0.0001);
  near("a clean exponential fits perfectly", fit.r2, 1, 0.001);
}

describe("solveOffPeriod");
{
  const points = decay(1500, 0.004, 12);
  const r = M.solveOffPeriod({ points, floor: 500 });
  eq("a clean decay is reported as falling", r.state, "falling");
  // ln(1500/500)/0.004 = 274.6 min from the FIRST point; the last point is
  // 110 min in, so ~165 remain.
  near("time to the floor is solved correctly", r.minutes, 165, 8);
  ok("the interval brackets the estimate", r.low < r.minutes && r.high > r.minutes);
}
{
  const r = M.solveOffPeriod({ points: decay(400, 0.004, 12), floor: 500 });
  eq("already under the floor is a fact, not a forecast", r.state, "already-low");
}
{
  const rising = decay(1500, -0.004, 12); // negative rate = climbing
  eq(
    "a climbing level is not extrapolated downwards",
    M.solveOffPeriod({ points: rising, floor: 500 }).state,
    "rising"
  );
}
{
  // Trending down overall but wildly scattered around that trend. It has to
  // fall, or the "rising" branch catches it first and the r-squared gate is
  // never reached — which is exactly what the first version of this test did.
  const noisy = [
    { minute: 0, level: 1500 },
    { minute: 10, level: 700 },
    { minute: 20, level: 1350 },
    { minute: 30, level: 620 },
    { minute: 40, level: 1100 },
    { minute: 50, level: 560 },
  ];
  const scattered = M.solveOffPeriod({ points: noisy, floor: 500 });
  eq(
    "a scattered trend is refused rather than guessed",
    scattered.state,
    "unclear"
  );
  ok(
    "and the fit really was poor, so the gate is what refused it",
    M.fitLogLinear(noisy).slope < 0 && M.fitLogLinear(noisy).r2 < 0.6,
    `slope ${M.fitLogLinear(noisy).slope.toFixed(4)}, r2 ${M.fitLogLinear(noisy).r2.toFixed(3)}`
  );
}
{
  eq(
    "too few points is refused",
    M.solveOffPeriod({ points: decay(1500, 0.004, 2), floor: 500 }).state,
    "unclear"
  );
}

describe("The dose gate");
{
  const points = decay(1500, 0.004, 12); // ~165 min to the floor
  const gated = M.solveOffPeriod({ points, floor: 500, nextDoseIn: 40 });
  eq("a dose arriving first stops the forecast", gated.state, "dose-first");
  eq("and reports when", gated.nextDoseIn, 40);

  const clear = M.solveOffPeriod({ points, floor: 500, nextDoseIn: 300 });
  eq("a dose arriving after does not", clear.state, "falling");

  const none = M.solveOffPeriod({ points, floor: 500, nextDoseIn: null });
  eq("no dose expected leaves the forecast alone", none.state, "falling");
}

describe("nextDoseIn respects what was actually logged");
{
  // Schedule is 7am, 1pm, 6pm. At 9am the next is 1pm = 240 min away.
  eq("next scheduled dose", M.nextDoseIn(9 * 60, []), 240);
  eq(
    "a dose logged as taken is not still coming",
    M.nextDoseIn(9 * 60, [{ scheduledHour: 13, kind: "taken" }]),
    540 // skips to 6pm
  );
  eq(
    "a MISSED dose means nothing arrives, so the decay continues",
    M.nextDoseIn(9 * 60, [{ scheduledHour: 13, kind: "missed" }]),
    540
  );
  eq(
    "a rescue dose is not a scheduled one and does not consume a slot",
    M.nextDoseIn(9 * 60, [{ scheduledHour: null, kind: "rescue" }]),
    240
  );
  eq("after the last dose there is nothing left today", M.nextDoseIn(20 * 60, []), null);
}

// ---------------------------------------------------------------------------
describe("Symptom score migration");
{
  const old = { stiffness: 2, tremor: 1, digestion: 3 };
  const next = M.migrateScores(old);
  eq("the retired digestion score becomes constipation", next.constipation, 3);
  eq("digestion itself is gone", next.digestion, undefined);
  eq("existing scores survive", next.stiffness, 2);
  eq("new symptoms default to zero", next.dyskinesia, 0);
  ok(
    "every current symptom is present",
    M.SYMPTOMS.every((s) => typeof next[s.id] === "number")
  );
}
eq("a missing score object does not throw", M.migrateScores(null).tremor, 0);
ok(
  "an explicit constipation score is not overwritten by digestion",
  M.migrateScores({ digestion: 3, constipation: 1 }).constipation === 1
);

describe("Symptom list integrity");
ok("ten items", M.SYMPTOMS.length === 10, `got ${M.SYMPTOMS.length}`);
ok("every id is unique", new Set(M.SYMPTOMS.map((s) => s.id)).size === M.SYMPTOMS.length);
ok("every colour is unique", new Set(M.SYMPTOMS.map((s) => s.colour)).size === M.SYMPTOMS.length);
ok("every item has a plain-language description", M.SYMPTOMS.every((s) => s.description && s.description.length > 20));
ok("every item belongs to a group", M.SYMPTOMS.every((s) => Boolean(s.group)));

// ---------------------------------------------------------------------------
describe("Dose adherence excludes rescue doses");
{
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);
  const ago = (h) => now - h * 3600000;
  const doses = [
    { kind: "taken", takenAt: ago(1) },
    { kind: "taken", takenAt: ago(5) },
    { kind: "missed", takenAt: ago(9) },
    { kind: "rescue", takenAt: ago(10) },
    { kind: "taken", takenAt: ago(24 * 9) }, // outside the 7 day window
  ];
  const s = M.doseSummary(doses, 7, now);
  eq("taken inside the window", s.taken, 2);
  eq("missed inside the window", s.missed, 1);
  eq("rescue counted separately", s.rescue, 1);
  eq("scheduled is taken plus missed only", s.scheduled, 3);
  eq("adherence ignores the rescue dose", s.adherence, 67);
  eq("nothing logged means no adherence figure", M.doseSummary([], 7, now).adherence, null);
}

describe("Exercise summary counts days, not just minutes");
{
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);
  const ago = (h) => now - h * 3600000;
  const sessions = [
    { minutes: 30, level: "moderate", doneAt: ago(2) },
    { minutes: 20, level: "light", doneAt: ago(3) }, // same day as above
    { minutes: 45, level: "vigorous", doneAt: ago(30) },
  ];
  const s = M.exerciseSummary(sessions, 7, now);
  eq("total minutes", s.totalMinutes, 95);
  eq("two sessions on one day is one active day", s.activeDays, 2);
  eq("moderate and above only", s.moderateMinutes, 75);
  eq("session count", s.sessions, 3);
}

// ---------------------------------------------------------------------------
console.log(
  failures === 0
    ? `\nPASS — ${checks} checks`
    : `\nFAIL — ${failures} of ${checks} checks failed`
);
process.exit(failures === 0 ? 0 : 1);
