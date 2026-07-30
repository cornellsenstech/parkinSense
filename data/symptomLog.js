import AsyncStorage from "@react-native-async-storage/async-storage";
import { emptyScores } from "./symptoms";

// Symptom check-ins, kept per patient, newest first.
//
// Every entry records WHO entered it. Partners do a lot of this logging, and a
// clinician needs to be able to tell a patient's self-report from a caregiver's
// observation rather than having the two silently merged.
const keyFor = (patientId) => `parkinsense:symptoms:${patientId}`;

export async function loadEntries(patientId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(patientId));
    const list = raw ? JSON.parse(raw) : [];
    return list.map(migrate);
  } catch {
    return [];
  }
}

// Early entries stored stiffness and tremor as bare fields with no reporter.
// Fold them into the current shape on read so old demo data still charts.
function migrate(entry) {
  if (entry.scores) return entry;
  return {
    ...entry,
    by: entry.by || "patient",
    scores: {
      ...emptyScores(),
      stiffness: entry.stiffness ?? 0,
      tremor: entry.tremor ?? 0,
    },
    sleep: entry.sleep ?? null,
    note: entry.note ?? "",
  };
}

// Returns the new entry so the caller can offer to undo it.
export async function saveEntry(patientId, { scores, sleep, note, by }) {
  const now = new Date();
  const entry = {
    id: `e-${now.getTime()}`,
    by: by === "caregiver" ? "caregiver" : "patient",
    scores: { ...emptyScores(), ...scores },
    sleep: sleep || null,
    note: (note || "").trim(),
    savedAt: now.getTime(),
    hour: now.getHours(),
    timeLabel: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
  try {
    const current = await loadEntries(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify([entry, ...current])
    );
    return entry;
  } catch {
    return null;
  }
}

export async function removeEntry(patientId, entryId) {
  try {
    const current = await loadEntries(patientId);
    await AsyncStorage.setItem(
      keyFor(patientId),
      JSON.stringify(current.filter((e) => e.id !== entryId))
    );
    return true;
  } catch {
    return false;
  }
}

// Oldest first, which is the order a chart needs.
export function chronological(entries) {
  return [...entries].sort((a, b) => a.savedAt - b.savedAt);
}
