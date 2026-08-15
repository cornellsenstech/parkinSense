import { Platform } from "react-native";
import { doseSummary, loadDoses } from "./doseLog";
import { exerciseSummary, loadExercise } from "./exerciseLog";
import { getHistory, rangeFor } from "./history";
import { loadMeals, proteinLabel } from "./mealLog";
import { chronological, loadEntries } from "./symptomLog";
import { SYMPTOMS, migrateScores } from "./symptoms";
import * as webllm from "./webllm";
import { notablePoints, weeklySummary } from "./weekly";

// An on-device language model that answers questions about the patient's own
// records — and nothing else.
//
// WHY IN THE BROWSER RATHER THAN AN API
// Every other part of this application holds to one rule: health data never
// leaves the device. A hosted model would break that rule on the first
// question, because the prompt would necessarily contain the patient's symptom
// scores, dose history and meals. Chrome's built-in Prompt API runs Gemini Nano
// locally, so inference happens on the same machine that holds the records and
// no network request is made at any point. If that is unavailable the app falls
// back to a deterministic responder rather than silently reaching for a cloud
// service.
//
// WHAT IT IS ALLOWED TO DO
// It reads back and summarises what the patient already recorded. It is
// explicitly not a clinical advisor. The safety layer below is three-deep:
// a refusal filter before the model sees the question, a system prompt that
// constrains the model, and an output filter after. Any question about changing
// medication is answered by a fixed string that the model never influences.

const AVAILABLE = "available";
const DOWNLOADABLE = "downloadable";
const UNAVAILABLE = "unavailable";

// Questions that must never reach a language model, however well prompted.
//
// This assistant is a support tool, not a clinician. It reads back what the
// patient recorded. It does not interpret, explain, diagnose, predict, or
// advise — and the boundary is enforced here rather than left to a prompt,
// because a fluent wrong answer in this domain does real harm.
//
// Two categories, because they deserve different replies. Being told "I can't
// discuss your medication" when you asked whether your tremor is getting worse
// is a non-sequitur, and a support tool that answers the wrong question is one
// people stop trusting.

// 1. Medication. The category where a plausible wrong answer is most dangerous.
const MEDICATION_PATTERNS = [
  /\b(should|shall|can|could|may|do|would)\s+i\s+(take|skip|stop|start|increase|decrease|double|change|adjust|split|delay)\b/i,
  /\b(increase|decrease|raise|lower|double|halve|stop|skip|adjust|change|switch)\s+(my|the|his|her|their)?\s*(dose|dosage|medication|levodopa|sinemet|madopar|tablet|pill)/i,
  /\bhow (much|many)\s+(should|do|can)\s+i\s+take\b/i,
  /\bis it (safe|ok|okay|fine|alright) to (take|skip|stop|double|delay)\b/i,
  /\b(prescrib|dosage)/i,
];

// 2. Clinical interpretation: diagnosis, causation, prognosis, significance,
// and whether to seek care. All of it belongs to a clinician who can examine
// the person and see their full history.
const CLINICAL_PATTERNS = [
  /\bdo i have\b/i,
  /\bdiagnos/i,
  /\bis (this|that|it|my|there) (normal|serious|bad|dangerous|concerning|expected|a sign|a symptom|something)\b/i,
  /\bwhat (is|are|could be|might be|would be)\s+(causing|the cause|wrong|happening)\b/i,
  /\bwhat (does|do)\b[^?]*\bmean\b/i,
  /\bwhy (am|do|is|are|does)\s+(i|my|me)\b/i,
  /\b(getting|going to get|going to be|becoming)\s+(worse|better)\b/i,
  /\b(progress(ion|ing)?|prognosis|life expectancy|how long (do|have) i)\b/i,
  /\bshould i (see|call|contact|visit|tell|worry|be worried|be concerned)\b/i,
  /\bside.?effect/i,
  /\b(treatment|therapy|surgery|operation|supplement|vitamin|remedy|cure)\b/i,
  /\b(is|am|are) (this|that|it|i|my)\b[^?]*\b(parkinson|dementia|stroke|depress)/i,
  /\bam i (developing|getting)\b/i,
];

const PARAGRAPH = "\n\n";

const REFUSAL_MEDICATION =
  "I can't help with anything about your medication — not the dose, the " +
  "timing, or whether to skip one. That has to come from your care team, who " +
  "can see your full history and examine you. You can send them a message " +
  "from the Help screen, or write the question down for your next " +
  "appointment." +
  PARAGRAPH +
  "I can tell you what your own records show, if that would help.";

const REFUSAL_CLINICAL =
  "That's a question for your care team, not for me. I'm a place to look up " +
  "what you've written down — I can't tell you what a symptom means, what's " +
  "causing it, whether it's normal, or what's likely to happen next. I'm not " +
  "a doctor, and I'd be guessing." +
  PARAGRAPH +
  "It's worth asking, though. There's a notepad on the Help screen for " +
  "questions to raise at your next appointment, and you can message your care " +
  "team from there too." +
  PARAGRAPH +
  "What I can do is read your own entries back to you — symptoms, doses, " +
  "meals and activity.";

// Which boundary a question crosses, or null if it crosses neither.
export function refusalFor(question) {
  if (MEDICATION_PATTERNS.some((re) => re.test(question))) {
    return REFUSAL_MEDICATION;
  }
  if (CLINICAL_PATTERNS.some((re) => re.test(question))) {
    return REFUSAL_CLINICAL;
  }
  return null;
}

// Reference to whichever shape of the API this browser exposes. The Prompt API
// moved from `window.ai.languageModel` to a global `LanguageModel` during its
// origin trial, and both shapes are still in the wild.
function api() {
  if (Platform.OS !== "web" || typeof globalThis === "undefined") return null;
  if (globalThis.LanguageModel) return globalThis.LanguageModel;
  if (globalThis.ai?.languageModel) return globalThis.ai.languageModel;
  return null;
}

// Whether an on-device model can answer right now, and if not, why. The reason
// is surfaced to the user, because "your browser cannot do this" and "the model
// is still downloading" call for different responses from them.
export async function availability() {
  const lm = api();
  if (!lm) {
    return {
      state: UNAVAILABLE,
      reason:
        "This browser has no on-device model. The assistant still answers from your records, just without conversational phrasing.",
    };
  }

  try {
    // Newer shape returns a string; the older one returns { available: ... }.
    if (typeof lm.availability === "function") {
      const state = await lm.availability();
      return { state, reason: null };
    }
    if (typeof lm.capabilities === "function") {
      const caps = await lm.capabilities();
      const map = {
        readily: AVAILABLE,
        "after-download": DOWNLOADABLE,
        no: UNAVAILABLE,
      };
      return { state: map[caps?.available] || UNAVAILABLE, reason: null };
    }
  } catch {
    // Treat any probe failure as unavailable rather than throwing into the UI.
  }
  return { state: UNAVAILABLE, reason: "The on-device model could not be reached." };
}

// The whole of what the model is told about its role. Deliberately narrow: it
// is a reader of one person's records, not a source of medical knowledge.
function systemPrompt(context) {
  return [
    "You are a calm, plain-spoken lookup tool inside a Parkinson's tracking app.",
    "You are NOT a doctor, nurse or clinician, and must never speak as one.",
    "Your only job is to read back what the RECORDS below already say.",
    "They are this patient's own entries. You have no other knowledge.",
    "",
    "Rules you must never break:",
    "1. Never advise on medication — not dose, timing, skipping, starting or stopping.",
    "2. Never diagnose. Never say what a symptom means, what is causing it,",
    "   whether it is normal or serious, or what is likely to happen next.",
    "3. If the RECORDS do not contain the answer, say plainly that you cannot see it.",
    "4. Never invent a number. Every figure you give must appear in the RECORDS.",
    "5. Keep it under 90 words. Short sentences. No lists unless asked.",
    "6. Point the person to their care team for anything clinical.",
    "",
    "RECORDS:",
    context,
  ].join("\n");
}

// A compact, factual digest of the last week, assembled from the same modules
// the charts use. Built fresh for every question so the model can never answer
// from a stale snapshot.
export async function buildContext(patientId) {
  const [meals, entries, doses, exercise] = await Promise.all([
    loadMeals(patientId),
    loadEntries(patientId),
    loadDoses(patientId),
    loadExercise(patientId),
  ]);

  const checkIns = chronological(entries);
  const readings = getHistory(patientId);
  const { low, high } = rangeFor(patientId);
  const summary = weeklySummary({
    patientId,
    readings,
    checkIns,
    meals,
    doses,
    exercise,
  });

  const lines = [];
  lines.push(`Therapeutic range: ${low} to ${high} ng/mL.`);
  if (summary.levels) {
    lines.push(
      `Levels over the last ${summary.levels.hours} hours: mean ${summary.levels.mean}, lowest ${summary.levels.min}, highest ${summary.levels.max}, ${summary.levels.percentInRange}% in range.`
    );
  }

  lines.push(`Check-ins in the last 7 days: ${summary.checkIns}.`);
  if (summary.overall != null) {
    lines.push(
      `Average symptom score: ${summary.overall} out of 4` +
        (summary.overallChange != null
          ? ` (${summary.overallChange >= 0 ? "up" : "down"} ${Math.abs(
              summary.overallChange
            )} on the week before).`
          : ".")
    );
  }

  summary.movers.forEach((m) => {
    lines.push(
      `${m.label}: average ${m.mean} out of 4` +
        (m.previous != null ? `, was ${m.previous} the week before.` : ".")
    );
  });

  lines.push(
    `Doses in the last 7 days: ${summary.doses.taken} taken, ${summary.doses.missed} missed, ${summary.doses.rescue} extra.`
  );
  lines.push(
    `Activity: ${summary.exercise.activeDays} active days of 7, ${summary.exercise.totalMinutes} minutes total.`
  );
  lines.push(
    `Meals logged in the last 7 days: ${summary.meals}, of which ${summary.proteinClashes} were high protein within an hour of a dose.`
  );

  const recent = [...checkIns].reverse().slice(0, 3);
  recent.forEach((entry) => {
    const scores = migrateScores(entry.scores);
    const worst = SYMPTOMS.map((s) => ({ label: s.label, v: scores[s.id] ?? 0 }))
      .filter((s) => s.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((s) => `${s.label} ${s.v}`)
      .join(", ");
    lines.push(
      `Check-in ${entry.timeLabel} by ${entry.by}: ${worst || "nothing troubling"}${
        entry.note ? `. Note: "${entry.note}"` : "."
      }`
    );
  });

  const lastMeal = meals[0];
  if (lastMeal) {
    lines.push(
      `Most recent meal: ${lastMeal.timeLabel}, ${proteinLabel(lastMeal.protein)}${
        lastMeal.food ? `, ${lastMeal.food}` : ""
      }.`
    );
  }

  return { text: lines.join("\n"), summary };
}

// Counts are read aloud as well as displayed, and "1 extra doses" is jarring
// spoken even more than written.
function plural(n, word) {
  return n === 1 ? word : `${word}s`;
}

export function isUnsafe(question) {
  return refusalFor(question) !== null;
}

export { REFUSAL_MEDICATION, REFUSAL_CLINICAL };

// Output guard. The system prompt is a request, not a guarantee, so anything
// that slipped through and reads like a dosing instruction is discarded and
// replaced with the refusal rather than shown.
// Output guard. The system prompt is a request, not a guarantee, so anything
// that came back sounding like a clinician is discarded regardless of what the
// model was told.
//
// Two families, matching the two refusal categories: instructions about
// medication, and interpretation of what the records mean. The second is the
// easier one to slip into — "your stiffness suggests" is a natural sentence for
// a language model to produce and a diagnosis for a patient to read.
const OUTPUT_RED_FLAGS = [
  // Medication instructions
  /\byou should (take|skip|stop|increase|decrease|double|change|adjust)\b/i,
  /\btake (an?|another|one|two|\d)\s*(extra|additional)?\s*(dose|tablet|pill)\b/i,
  /\b(increase|decrease|reduce|raise|lower|adjust) your (dose|dosage|medication)\b/i,
  /\b\d+\s*(mg|milligram)/i,

  // Clinical interpretation
  /\b(suggests?|indicates?|means that|is a sign of|consistent with|points to)\b/i,
  /\byou (may|might|could|probably|likely) (have|be experiencing|be developing)\b/i,
  /\b(this|that|it) (is|could be|may be|might be) (caused by|due to|because of)\b/i,
  /\byour (condition|disease|parkinson)[^.]{0,24}(is|has been) (worsening|progressing|improving)\b/i,
  /\byou should (see|call|contact|consult|visit) (a|your) (doctor|neurologist|gp)\b/i,
  /\bdiagnos/i,
];

function numbersAreGrounded(text, context) {
  const inContext = new Set((context.match(/\d+(?:\.\d+)?/g) || []));
  const inAnswer = text.match(/\d+(?:\.\d+)?/g) || [];
  return inAnswer.every((n) => inContext.has(n));
}

// Returns { text } when the generation is safe to show, or { reason } naming
// why it was discarded. The reason is displayed, so it has to say which check
// actually failed rather than guessing — a generation rejected for sounding
// like a diagnosis is a different fault from one that invented a number, and
// reporting the wrong one would be its own small dishonesty.
function guardOutput(text, context) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { reason: "The model returned nothing." };

  // A generation that crossed the line is discarded outright rather than
  // swapped for a refusal: the patient asked something answerable, so they
  // get the deterministic answer, not a lecture about boundaries.
  if (OUTPUT_RED_FLAGS.some((re) => re.test(trimmed))) {
    return {
      reason:
        "The model started interpreting rather than reporting, so its answer was discarded.",
    };
  }

  if (context && !numbersAreGrounded(trimmed, context)) {
    return {
      reason:
        "The model quoted a figure that is not in your records, so its answer was discarded.",
    };
  }

  return { text: trimmed };
}

// Deterministic answers, used when no on-device model exists and as the source
// of truth the model is asked to phrase. Every branch reads a real figure.
export function ruleAnswer(question, summary) {
  const q = question.toLowerCase();
  const has = (...words) => words.some((w) => q.includes(w));

  if (has("dose", "missed", "adherence", "medication", "took")) {
    const d = summary.doses;
    return `Over the last 7 days you logged ${d.taken} doses taken and ${d.missed} missed, plus ${d.rescue} extra ${plural(d.rescue, "dose")}.${
      d.adherence != null ? ` That is ${d.adherence}% of your scheduled doses.` : ""
    }`;
  }
  if (has("exercise", "active", "walk", "activity", "move")) {
    const e = summary.exercise;
    return `You were active on ${e.activeDays} of the last 7 days, ${e.totalMinutes} minutes in total, of which ${e.moderateMinutes} were moderate or harder.`;
  }
  if (has("protein", "meal", "eat", "food", "ate")) {
    return `You logged ${summary.meals} meals in the last 7 days. ${summary.proteinClashes} of them were high protein within an hour of a dose, which is when protein competes with your medication for absorption.`;
  }
  if (has("worse", "worsening", "changed", "trend", "compared")) {
    if (summary.worsening.length) {
      const m = summary.worsening[0];
      return `${m.label} has moved most: from an average of ${m.previous} to ${m.mean} out of 4 compared with the week before.`;
    }
    return "Nothing has moved by much compared with the week before.";
  }
  if (has("sleep")) {
    return "Sleep is recorded with your check-ins. I can see the entries but not a weekly figure for it — the Symptoms tab in History shows them alongside everything else.";
  }
  if (has("worst", "highest", "bad")) {
    return summary.worst
      ? `Your highest average this week is ${summary.worst.label}, at ${summary.worst.mean} out of 4.`
      : "There are no check-ins in the last 7 days to compare.";
  }
  if (has("level", "range", "concentration", "ng")) {
    return summary.levels
      ? `Across the last ${summary.levels.hours} hours your level averaged ${summary.levels.mean} ng/mL, ranging from ${summary.levels.min} to ${summary.levels.max}, and sat inside your range ${summary.levels.percentInRange}% of the time.`
      : "There are no readings available to summarise.";
  }

  const points = notablePoints(summary);
  if (points.length) {
    return `Here is what stands out this week. ${points
      .slice(0, 3)
      .map((p) => p.text)
      .join(" ")}`;
  }
  return "I can answer questions about your check-ins, doses, meals, activity and levels. Try asking what has changed this week.";
}

// Ask an on-device model, streaming tokens back through `onToken`. Returns the
// final text.
//
// Three engines are tried in order of quality, and every one of them sits
// behind the same three safety layers. The engine can change without the safety
// behaviour changing, which is the point of putting the filters here rather
// than inside any single engine's wrapper.
//
//   1. WebLLM on WebGPU — best answers, but only once the user has explicitly
//      accepted the weight download.
//   2. Chrome's built-in Prompt API — no download, narrower availability.
//   3. The deterministic responder — always works, never wrong, reads stiffly.
//
// Whatever answers, the figures come from the same digest, so the three cannot
// contradict each other on a number.
// Returns { text, engine, degraded }. `engine` names what actually produced the
// answer, which the panel displays.
//
// Reporting the engine is not a debugging convenience — it is the same
// commitment the rest of the app makes about the sensor feed. Quietly dropping
// from a language model to a template, while the interface still claims a model
// is answering, is precisely the class of dishonesty this codebase avoids
// elsewhere. A swallowed exception here would have shipped that.
export async function ask(patientId, question, onToken) {
  const refusal = refusalFor(question);
  if (refusal) {
    return { text: refusal, engine: "refusal", degraded: false };
  }

  const { text: context, summary } = await buildContext(patientId);
  const fallback = ruleAnswer(question, summary);
  let degraded = null;

  // Engine 1: WebLLM, if the user has loaded it in this session.
  if (webllm.ready()) {
    try {
      const text = await webllm.generate(
        [
          { role: "system", content: systemPrompt(context) },
          { role: "user", content: question },
        ],
        onToken
      );
      const guarded = guardOutput(text, context);
      if (guarded.text) {
        return { text: guarded.text, engine: "webllm", degraded: false };
      }
      degraded = guarded.reason;
    } catch (error) {
      degraded = `On-device model failed: ${String(error?.message || error).slice(0, 120)}`;
    }
  }

  const lm = api();
  if (!lm) return { text: fallback, engine: "rules", degraded };

  let session;
  try {
    const { state } = await availability();
    if (state !== AVAILABLE && state !== DOWNLOADABLE) {
      return { text: fallback, engine: "rules", degraded };
    }

    session = await lm.create({
      // Both spellings, since the option was renamed mid-trial.
      initialPrompts: [{ role: "system", content: systemPrompt(context) }],
      systemPrompt: systemPrompt(context),
      temperature: 0.2,
      topK: 3,
    });

    let full = "";
    if (typeof session.promptStreaming === "function") {
      const stream = session.promptStreaming(question);
      for await (const chunk of stream) {
        // Older builds emit the whole string so far; newer ones emit deltas.
        full = chunk.length >= full.length && chunk.startsWith(full.slice(0, 8))
          ? chunk
          : full + chunk;
        onToken?.(full);
      }
    } else {
      full = await session.prompt(question);
    }

    const guarded = guardOutput(full, context);
    if (guarded.text) {
      return { text: guarded.text, engine: "prompt-api", degraded };
    }
    return { text: fallback, engine: "rules", degraded: degraded || guarded.reason };
  } catch (error) {
    return {
      text: fallback,
      engine: "rules",
      degraded:
        degraded ||
        `Built-in model failed: ${String(error?.message || error).slice(0, 120)}`,
    };
  } finally {
    try {
      session?.destroy?.();
    } catch {
      // Nothing useful to do if teardown fails.
    }
  }
}

export const SUGGESTIONS = [
  "What has changed this week?",
  "How many doses did I miss?",
  "How active have I been?",
  "Which symptom is worst right now?",
];
