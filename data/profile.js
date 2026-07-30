import AsyncStorage from "@react-native-async-storage/async-storage";
import { patients } from "./patients";

// Edits a patient makes to their own profile, stored per patient id. The
// roster in patients.js stays the starting point; anything saved here wins.
const keyFor = (patientId) => `parkinsense:profile:${patientId}`;

const FIELDS = ["age", "weight", "height", "email"];

export function defaultProfile(patientId) {
  const patient = patients.find((p) => p.id === patientId) || patients[0];
  return {
    name: patient.name,
    age: String(patient.age),
    weight: patient.weight,
    height: patient.height,
    email: patient.email,
    photo: null,
  };
}

export async function loadProfile(patientId) {
  const base = defaultProfile(patientId);
  try {
    const saved = await AsyncStorage.getItem(keyFor(patientId));
    // Merge rather than replace, so a profile saved before a field existed
    // still gets a sensible value for the new one.
    return saved ? { ...base, ...JSON.parse(saved) } : base;
  } catch {
    return base;
  }
}

export async function saveProfile(patientId, profile) {
  try {
    await AsyncStorage.setItem(keyFor(patientId), JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

// Reads well when spoken aloud, and keeps the doctor view consistent.
export function describeProfile(profile) {
  return FIELDS.filter((f) => profile[f])
    .map((f) => `${f}: ${profile[f]}`)
    .join(", ");
}
