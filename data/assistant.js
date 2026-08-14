import { Platform } from "react-native";
import { doseSummary, loadDoses } from "./doseLog";
import { exerciseSummary, loadExercise } from "./exerciseLog";
import { getHistory, rangeFor } from "./history";
import { loadMeals, proteinLabel } from "./mealLog";
import { chronological, loadEntries } from "./symptomLog";
import { SYMPTOMS, migrateScores } from "./symptoms";
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
// Dosing is the category where a plausible-sounding wrong answer does real
// harm, so it is intercepted before inference rather than corrected after.
const UNSAFE_PATTERNS = [
  /\b(should|shall|can|could|may|do)\s+i\s+(take|skip|stop|start|increase|decrease|double|change|adjust|split)\b/i,
  /\b(increase|decrease|raise|lower|double|halve|stop|skip|adjust|change)\s+(my|the|his|her|their)?\s*(dose|dosage|medication|levodopa|sinemet|madopar|tablet)/i,
  /\bhow (much|many)\s+(should|do)\s+i\s+take\b/i,
  /\bis it (safe|ok|okay|fine) to (take|skip|stop|double)\b/i,
  /\b(diagnos|prescrib)/i,
];

const REFUSAL =
  "I can't help with anything about changing your medication — not the dose, " +
  "the timing, or whether to skip one. That has to come from your care team, " +
  "who can see your full history and examine you. You can send them a message " +
  "from this screen, or write the question down for your next appointment.\n\n" +
  "I can tell you what your own records show, if that helps.";

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
    "You are a calm, plain-spoken assistant inside a Parkinson's tracking app.",
    "You may ONLY answer using the RECORDS below. They are this patient's own entries.",
    "",
    "Rules you must never break:",
    "1. Never advise on medication — not dose, timing, skipping, starting or stopping.",
    "2. Never diagnose, and never predict the course of the disease.",
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
  return UNSAFE_PATTERNS.some((re) => re.test(question));
}

export { REFUSAL };

// Output guard. The system prompt is a request, not a guarantee, so anything
// that slipped through and reads like a dosing instruction is discarded and
// replaced with the refusal rather than shown.
const OUTPUT_RED_FLAGS = [
  /\byou should (take|skip|stop|increase|decrease|double|change)\b/i,
  /\btake (an?|another|one|two|\d)\s*(extra|additional)?\s*(dose|tablet|pill)\b/i,
  /\b(increase|decrease|reduce|raise|lower) your (dose|dosage|medication)\b/i,
];

function guardOutput(text) {
  if (!text) return null;
  if (OUTPUT_RED_FLAGS.some((re) => re.test(text))) return REFUSAL;
  return text.trim();
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

// Ask the on-device model, streaming tokens back through `onToken`. Returns the
// final text. Falls back to the rule-based answer on any failure, so the panel
// always produces something.
export async function ask(patientId, question, onToken) {
  if (isUnsafe(question)) return REFUSAL;

  const { text: context, summary } = await buildContext(patientId);
  const fallback = ruleAnswer(question, summary);

  const lm = api();
  if (!lm) return fallback;

  let session;
  try {
    const { state } = await availability();
    if (state !== AVAILABLE && state !== DOWNLOADABLE) return fallback;

    session = await lm.create({
      // Both spellings, since the option was renamed mid-trial.
      initialPrompts: [{ role: "system", content: systemPrompt(context) }],
      systemPrompt: systemPrompt(context),
      temperature: 0.2,
      topK: 3,
    });

    if (typeof session.promptStreaming === "function") {
      const stream = session.promptStreaming(question);
      let full = "";
      for await (const chunk of stream) {
        // Older builds emit the whole string so far; newer ones emit deltas.
        full = chunk.length >= full.length && chunk.startsWith(full.slice(0, 8))
          ? chunk
          : full + chunk;
        onToken?.(full);
      }
      return guardOutput(full) || fallback;
    }

    const once = await session.prompt(question);
    return guardOutput(once) || fallback;
  } catch {
    return fallback;
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
