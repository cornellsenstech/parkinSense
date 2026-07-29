import { createContext } from "react";

// Shared session state: which portal (patient | doctor) and, for patients,
// the signed-in username. setRole(null) returns to the role picker.
export const RoleContext = createContext({
  role: null,
  setRole: () => {},
  user: null,
  setUser: () => {},
});
