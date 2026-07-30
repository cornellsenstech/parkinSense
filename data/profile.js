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
    // The caregiver's own details. Kept alongside the patient's rather than in a
    // separate record, because in practice they share one device and one login.
    caregiverName: "",
    caregiverRelation: "",
    caregiverPhone: "",
  };
}

// First name of whoever is using the app, so the greeting can address them.
// Falls back to the patient when no caregiver has been named yet.
export function displayFirstName(profile, reporter) {
  const source =
    reporter === "caregiver" && profile.caregiverName
      ? profile.caregiverName
      : profile.name;
  const parts = String(source || "").trim().split(" ");
  const titles = ["mr", "mrs", "ms", "miss", "dr", "prof"];
  const first = parts[0] ? parts[0].replace(".", "").toLowerCase() : "";
  return titles.includes(first) && parts.length > 1 ? parts[1] : parts[0] || "";
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
