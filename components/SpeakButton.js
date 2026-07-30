import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Pressable } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";

// Reads one module aloud. Renders nothing until read-aloud is switched on, so
// the screen stays uncluttered for patients who don't use it.
//
// While this button's own text is playing it turns into a stop square, so the
// same tap that started the audio also ends it — no hunting for a second
// control, which matters when tapping is difficult.
export default function SpeakButton({ text, label = "Read this section aloud" }) {
  const { readAloud, speak, stop, speakingId } = useContext(AccessibilityContext);

  if (!readAloud || !text) return null;

  const speaking = speakingId === text;

  return (
    <Pressable
      onPress={() => (speaking ? stop() : speak(text, text))}
      accessibilityRole="button"
      accessibilityLabel={speaking ? "Stop reading" : label}
      className={`items-center justify-center rounded-full border ${
        speaking ? "bg-black border-black" : "bg-gray-100 border-gray-300"
      }`}
      style={{ width: 48, height: 48 }}
    >
      <Ionicons
        name={speaking ? "square" : "volume-high"}
        size={speaking ? 18 : 24}
        color={speaking ? "#ffffff" : "#111827"}
      />
    </Pressable>
  );
}
