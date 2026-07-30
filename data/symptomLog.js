import AsyncStorage from "@react-native-async-storage/async-storage";

// Symptom check-ins the patient has saved, kept per patient.
//
// Entries are stored newest first and carry their own id so a mis-tap can be
// undone by removing exactly the one just written, rather than guessing.
const keyFor = (patientId) => `parkinsense:symptoms:${patientId}`;

export async function loadEntries(patientId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Returns the new entry so the caller can offer to undo it.
export async function saveEntry(patientId, { stiffness, tremor }) {
  const now = new Date();
  const entry = {
    id: `e-${now.getTime()}`,
    stiffness,
    tremor,
    savedAt: now.getTime(),
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
