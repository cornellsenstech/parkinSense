import AsyncStorage from "@react-native-async-storage/async-storage";

// Questions the patient wants to ask at their next appointment.
//
// This exists because of a specific, well-documented failure: people think of
// the question at 3am when the tremor wakes them, and cannot recall it in a
// fifteen-minute clinic slot three weeks later. A notepad that lives beside the
// symptom log means the question gets written down at the moment it occurs.
//
// Kept out of the message thread on purpose. A question for the next appointment
// is not a message that needs answering today, and putting it in the inbox
// would either create noise for the clinician or pressure on the patient not to
// write it down. It can be sent as a thread deliberately, from a button.
const keyFor = (patientId) => `parkinsense:questions:${patientId}`;

// Prompts, not a fixed list. Blank notepads stay blank; these give people a
// place to start.
export const QUESTION_PROMPTS = [
  "Should my dose timing change?",
  "What can I do about the off periods in the afternoon?",
  "Is this side effect expected?",
  "Should I be doing a different kind of exercise?",
  "What should I do if I miss a dose?",
  "Is it worth seeing a physiotherapist or speech therapist?",
];

export async function loadQuestions(patientId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function write(patientId, list) {
  try {
    await AsyncStorage.setItem(keyFor(patientId), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export async function addQuestion(patientId, text, by) {
  const clean = (text || "").trim();
  if (!clean) return null;

  const now = new Date();
  const entry = {
    id: `q-${now.getTime()}`,
    text: clean,
    by: by === "caregiver" ? "caregiver" : "patient",
    answered: false,
    addedAt: now.getTime(),
    dateLabel: now.toLocaleDateString([], { month: "short", day: "numeric" }),
  };

  const current = await loadQuestions(patientId);
  const saved = await write(patientId, [entry, ...current]);
  return saved ? entry : null;
}

// Ticking a question off rather than deleting it: at the next appointment it is
// useful to see what was already covered, and a deleted question cannot be
// recovered by someone with a tremor who hit the wrong control.
export async function toggleAnswered(patientId, questionId) {
  const current = await loadQuestions(patientId);
  return write(
    patientId,
    current.map((q) =>
      q.id === questionId ? { ...q, answered: !q.answered } : q
    )
  );
}

export async function removeQuestion(patientId, questionId) {
  const current = await loadQuestions(patientId);
  return write(
    patientId,
    current.filter((q) => q.id !== questionId)
  );
}

export function openQuestions(list) {
  return list.filter((q) => !q.answered);
}
