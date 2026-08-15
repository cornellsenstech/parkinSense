// Runs the walk-forward backtest against the shipped forecasting model.
//
//   node scripts/backtest-forecast.mjs
//   node scripts/backtest-forecast.mjs --no-dose-gate
//
// The data modules are ESM with extensionless relative imports, which node will
// not resolve, and they pull in React Native. Rather than reimplement the maths
// — which would defeat the entire point of measuring what ships — the sources
// are read, their import/export keywords stripped, concatenated in dependency
// order and evaluated as one module. No logic is altered.
//
// `--no-dose-gate` disables the dose gate so the before/after can be measured
// in one sitting. That flag is the reason this file exists as a script rather
// than a note in a commit message: the improvement is a number, and a number
// nobody can reproduce is a claim.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const noDoseGate = process.argv.includes("--no-dose-gate");

const strip = (file) =>
  fs
    .readFileSync(path.join(root, "data", file), "utf8")
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^export\s+/gm, "");

let source = [
  strip("patients.js"),
  strip("history.js"),
  strip("forecast.js"),
  strip("backtest.js"),
].join("\n");

if (noDoseGate) {
  // Neutralise only the gate, leaving every other constant and branch intact,
  // so the two runs differ by exactly one decision.
  source = source.replace(
    "if (nextDoseIn != null && nextDoseIn < minutes) {",
    "if (false) {"
  );
}

const mod = await import(
  "data:text/javascript;base64," +
    Buffer.from(source + "\nexport { backtestAll };").toString("base64")
);

const full = mod.backtestAll();
const r = full.overall;
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

console.log(noDoseGate ? "DOSE GATE OFF (baseline)" : "DOSE GATE ON (shipped)");
console.log("=".repeat(46));
console.log(`forecasts issued        ${r.predictions}`);
console.log(`median absolute error   ${r.medianAbsError} min`);
console.log(`within 30 min           ${pct(r.within30)}`);
console.log(`dose-interrupted        ${r.doseIntervened}`);
console.log(`  excluding those       ${r.medianAbsErrorNoDose} min, ${pct(r.within30NoDose)} within 30`);
console.log(`declined                ${r.declined}`);
console.log(`  reasons               ${JSON.stringify(r.declinedReasons)}`);
console.log("");
console.log("per patient (n, median, median excl. dose-interrupted)");
for (const p of full.patients) {
  console.log(
    `  ${p.patientId.padEnd(9)} ${String(p.predictions).padStart(2)}  ` +
      `${String(p.medianAbsError).padStart(4)} min  ` +
      `${String(p.medianAbsErrorNoDose ?? "—").padStart(4)} min`
  );
}
