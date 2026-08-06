// Everything the patient or caregiver can record, defined once so the form, the
// charts and the doctor view can never disagree about the list or the wording.
//
// All scored items run 0 (none) to 4 (severe) in the same direction, including
// the non-motor ones. Cognition and speech are phrased as difficulty rather than
// ability for exactly that reason: mixing "higher is worse" and "higher is
// better" on one chart is how graphs get misread.
//
// Every symptom carries a `description`. People asked to rate "dyskinesia" or
// "slowness" out of four need to know what is being asked before the number
// means anything, and two patients guessing differently is worse than no data.
export const SYMPTOMS = [
  {
    id: "stiffness",
    label: "Stiffness",
    group: "Movement",
    description: "Muscles feel tight or rigid, or joints feel hard to move.",
    colour: "#7c3aed",
    core: true,
  },
  {
    id: "tremor",
    label: "Tremor",
    group: "Movement",
    description: "Shaking you are not choosing — a hand, arm, leg, chin or jaw.",
    colour: "#ea580c",
    core: true,
  },
  {
    id: "slowness",
    label: "Physical slowness",
    group: "Movement",
    description:
      "Movements are smaller and slower than usual. Dressing, walking or getting out of a chair takes longer.",
    colour: "#0891b2",
  },
  {
    // Dyskinesia is the opposite failure to slowness, and patients routinely
    // confuse the two. Kept next to it deliberately, with the contrast spelled
    // out, because "too much movement" and "too little" need different answers.
    id: "dyskinesia",
    label: "Extra movements",
    group: "Movement",
    description:
      "Movements you cannot control — swaying, writhing, restless fidgeting. This is dyskinesia. Not the same as tremor, and the opposite of slowness.",
    colour: "#db2777",
  },
  {
    id: "fatigue",
    label: "Tiredness",
    group: "How you felt",
    description:
      "Low energy or worn out, even after resting. This is about energy, not about muscles being slow.",
    colour: "#65a30d",
  },
  {
    id: "pain",
    label: "Pain",
    group: "How you felt",
    description: "Aching, cramping or discomfort anywhere in the body.",
    colour: "#be123c",
  },
  {
    id: "cognition",
    label: "Thinking felt slow",
    group: "How you felt",
    description:
      "Foggy, hard to concentrate, losing the thread, or taking longer to find words.",
    colour: "#4f46e5",
  },
  {
    id: "speech",
    label: "Speech was hard",
    group: "How you felt",
    description:
      "Voice quiet, slurred, or words hard to get out. Others asking you to repeat yourself counts.",
    colour: "#0d9488",
  },
  {
    // Split out of a single "digestion" item. Constipation and bloating move for
    // different reasons and are managed differently, so averaging them lost the
    // signal a clinician actually wanted.
    id: "constipation",
    label: "Constipation",
    group: "Digestion",
    description:
      "Bowels slower, harder or less frequent than normal for you.",
    colour: "#a16207",
  },
  {
    id: "bloating",
    label: "Fullness or bloating",
    group: "Digestion",
    description:
      "Feeling full, swollen or heavy after eating, or food sitting longer than usual.",
    colour: "#78350f",
  },
];

// The order the form and the charts group them in.
export const SYMPTOM_GROUPS = ["Movement", "How you felt", "Digestion"];

// Index 0 is "None", so a score and its word are always shown together in the
// UI. Showing the selected word on its own, away from the buttons, made "None"
// look like a label for the 4 — the numbers and the words have to be paired.
export const SEVERITY_WORDS = ["None", "Slight", "Mild", "Moderate", "Severe"];

// Sleep is a quality, not a severity, so it gets faces rather than a 0-4 scale.
export const SLEEP_OPTIONS = [
  { id: "good", label: "Slept well", icon: "happy-outline", colour: "#166534" },
  { id: "ok", label: "Broken sleep", icon: "remove-circle-outline", colour: "#9a3412" },
  { id: "bad", label: "Slept badly", icon: "sad-outline", colour: "#991b1b" },
];

export function symptomLabel(id) {
  const match = SYMPTOMS.find((s) => s.id === id);
  return match ? match.label : id;
}

export function symptomsInGroup(group) {
  return SYMPTOMS.filter((s) => s.group === group);
}

export function sleepLabel(id) {
  const match = SLEEP_OPTIONS.find((s) => s.id === id);
  return match ? match.label : null;
}

// A blank set of scores, so the form and the store agree on the starting shape.
export function emptyScores() {
  const scores = {};
  SYMPTOMS.forEach((s) => {
    scores[s.id] = 0;
  });
  return scores;
}

// Entries recorded before the list was expanded used a single `digestion` score
// and had no slowness or dyskinesia. Fold the old score into constipation on
// read, rather than dropping it, so a fortnight of history does not go blank
// the moment the list changes.
export function migrateScores(scores) {
  if (!scores) return emptyScores();
  const next = { ...emptyScores(), ...scores };
  if (scores.digestion != null && scores.constipation == null) {
    next.constipation = scores.digestion;
  }
  delete next.digestion;
  return next;
}
