import AsyncStorage from "@react-native-async-storage/async-storage";

// Events a patient has saved, kept per patient like their notes and profile.
const keyFor = (patientId) => `parkinsense:saved-events:${patientId}`;

export async function loadSaved(patientId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(patientId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Returns the new list so the caller can update state from one source.
export async function toggleSaved(patientId, eventId) {
  const current = await loadSaved(patientId);
  const next = current.includes(eventId)
    ? current.filter((id) => id !== eventId)
    : [...current, eventId];
  try {
    await AsyncStorage.setItem(keyFor(patientId), JSON.stringify(next));
  } catch {
    // Ignore a write failure — returning `next` still updates the screen, and
    // the patient can retry rather than seeing the tap do nothing.
  }
  return next;
}
