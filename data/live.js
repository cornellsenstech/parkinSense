import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { loadDoses } from "./doseLog";
import { loadExercise } from "./exerciseLog";
import { loadMeals } from "./mealLog";
import { chronological, loadEntries } from "./symptomLog";

// Keeps the clinician view in step with what a patient is recording right now.
//
// The demo is two browser tabs on one machine, and everything is stored in
// localStorage, so there are two ways to notice a change:
//
//   1. The `storage` event, which the browser fires in OTHER tabs whenever a
//      tab writes to localStorage. This is the one that matters — a patient
//      saving a check-in updates the clinician's tab in the same instant, with
//      no polling delay at all.
//   2. A slow interval poll, because the storage event does not fire in the tab
//      that made the change, does not exist on native, and would leave the view
//      stale if a write happened while this screen was mounting.
//
// This is deliberately not called "real time" anywhere the user can see. It is
// a shared store being re-read, not a socket, and a clinician should not be
// told a number is live when the underlying device feed is still mocked.
const POLL_MS = 4000;

export function useLiveRecords(patientId, { enabled = true } = {}) {
  const [records, setRecords] = useState({
    meals: [],
    checkIns: [],
    doses: [],
    exercise: [],
  });
  const [updatedAt, setUpdatedAt] = useState(null);

  // Held in a ref so the storage listener and the interval both read the
  // current patient without being torn down and rebuilt on every change.
  const patientRef = useRef(patientId);
  patientRef.current = patientId;

  const refresh = useCallback(async () => {
    const id = patientRef.current;
    if (!id) return;

    const [meals, entries, doses, exercise] = await Promise.all([
      loadMeals(id),
      loadEntries(id),
      loadDoses(id),
      loadExercise(id),
    ]);

    // Dropped if the doctor moved to another patient mid-read, so one
    // patient's data can never land on another's record.
    if (patientRef.current !== id) return;

    setRecords({
      meals,
      checkIns: chronological(entries),
      doses,
      exercise,
    });
    setUpdatedAt(Date.now());
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const run = () => {
      if (!cancelled) refresh();
    };

    run();
    const timer = setInterval(run, POLL_MS);

    // Cross-tab: fires the moment the patient tab writes anything of ours.
    let onStorage;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      onStorage = (event) => {
        if (!event.key || event.key.startsWith("parkinsense:")) run();
      };
      window.addEventListener("storage", onStorage);
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (onStorage) window.removeEventListener("storage", onStorage);
    };
  }, [enabled, patientId, refresh]);

  return { ...records, updatedAt, refresh };
}

// "Updated 12 seconds ago", for the small line under a live panel. Shown so a
// clinician can tell the difference between "nothing has changed" and "this
// screen stopped updating".
export function sinceLabel(timestamp, now = Date.now()) {
  if (!timestamp) return "not loaded yet";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
}
