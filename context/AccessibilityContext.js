import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { expandForSpeech } from "../data/speech";

const KEY = "parkinsense:accessibility";

export const TEXT_SIZES = [
  { id: "normal", label: "Normal", scale: 1 },
  { id: "large", label: "Large", scale: 1.15 },
  { id: "largest", label: "Largest", scale: 1.3 },
];

// Read-aloud starts ON for everyone. Most patients here benefit from it, so
// it should be there without being discovered first — someone who doesn't want
// it can switch it off in Profile and that choice is remembered.
const DEFAULTS = { readAloud: true, textSize: "normal" };

export const AccessibilityContext = createContext({
  ...DEFAULTS,
  scale: 1,
  speakingId: null,
  setReadAloud: () => {},
  setTextSize: () => {},
  speak: () => {},
  stop: () => {},
});

export function AccessibilityProvider({ children }) {
  // Both settings live in one object. Kept together so a change to either one
  // always writes the other's current value rather than a stale copy.
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Restore on launch.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (active && saved) setSettings({ ...DEFAULTS, ...JSON.parse(saved) });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Save whenever settings change — but not before the load has finished, or
  // the defaults would overwrite what was stored.
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  // Functional updates, so rapid changes can't clobber each other.
  const setReadAloud = useCallback((value) => {
    setSettings((current) => ({ ...current, readAloud: value }));
    if (!value) Speech.stop(); // turning it off should silence it immediately
  }, []);

  const setTextSize = useCallback((value) => {
    setSettings((current) => ({ ...current, textSize: value }));
  }, []);

  // Which text is currently being spoken, so the button that started it can
  // show a stop control instead of offering to play again.
  const [speakingId, setSpeakingId] = useState(null);

  // Speaking replaces whatever was already playing, so tapping two speakers in
  // a row never produces overlapping audio.
  const speak = useCallback((text, id) => {
    Speech.stop();
    setSpeakingId(id ?? text);
    Speech.speak(expandForSpeech(text), {
      rate: 0.9,
      // Clear on every terminal outcome, or a button could stay stuck showing
      // "stop" after the audio has finished.
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, []);

  const stop = useCallback(() => {
    Speech.stop();
    setSpeakingId(null);
  }, []);

  const scale = useMemo(
    () =>
      (TEXT_SIZES.find((s) => s.id === settings.textSize) || TEXT_SIZES[0]).scale,
    [settings.textSize]
  );

  const value = useMemo(
    () => ({
      readAloud: settings.readAloud,
      textSize: settings.textSize,
      scale,
      speakingId,
      setReadAloud,
      setTextSize,
      speak,
      stop,
    }),
    [settings, scale, speakingId, setReadAloud, setTextSize, speak, stop]
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}
