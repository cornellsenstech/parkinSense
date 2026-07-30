import { createContext } from "react";

// Shared session state: which portal (patient | doctor), the signed-in patient,
// and who is doing the recording.
//
// `reporter` is "patient" or "caregiver". Partners do a lot of this logging in
// practice, so every symptom entry records who entered it — otherwise the two
// get silently mixed and a clinician cannot tell self-report from observation.
export const RoleContext = createContext({
  role: null,
  setRole: () => {},
  user: null,
  setUser: () => {},
  reporter: "patient",
  setReporter: () => {},
});
