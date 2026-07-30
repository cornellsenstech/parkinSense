// Everything the patient or caregiver can record, defined once so the form, the
// charts and the doctor view can never disagree about the list or the wording.
//
// All scored items run 0 (none) to 4 (severe) in the same direction, including
// the non-motor ones. Cognition and speech are phrased as difficulty rather than
// ability for exactly that reason: mixing "higher is worse" and "higher is
// better" on one chart is how graphs get misread.
export const SYMPTOMS = [
  { id: "stiffness", label: "Stiffness", colour: "#7c3aed", core: true },
  { id: "tremor", label: "Tremor", colour: "#ea580c", core: true },
  { id: "fatigue", label: "Muscle fatigue", colour: "#0891b2" },
  { id: "pain", label: "Pain", colour: "#be123c" },
  { id: "cognition", label: "Thinking felt slow", colour: "#4f46e5" },
  { id: "speech", label: "Speech was hard", colour: "#0d9488" },
  { id: "digestion", label: "Digestion slow", colour: "#a16207" },
];

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
