import AsyncStorage from "@react-native-async-storage/async-storage";

// Clinician notes are stored per patient, keyed by patient id, so each record
// keeps its own text. AsyncStorage uses localStorage on web and the native
// store on device — either way the notes stay on this machine.
const keyFor = (patientId) => `parkinsense:notes:${patientId}`;

export async function loadNote(patientId) {
  try {
    const saved = await AsyncStorage.getItem(keyFor(patientId));
    return saved || "";
  } catch {
    return ""; // a read failure shouldn't blank the screen
  }
}

export async function saveNote(patientId, text) {
  try {
    await AsyncStorage.setItem(keyFor(patientId), text);
    return true;
  } catch {
    return false;
  }
}
