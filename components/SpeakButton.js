import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Pressable } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";

// Reads one module aloud. Renders nothing until read-aloud is switched on, so
// the screen stays uncluttered for patients who don't use it.
export default function SpeakButton({ text, label = "Read this section aloud" }) {
  const { readAloud, speak } = useContext(AccessibilityContext);

  if (!readAloud || !text) return null;

  return (
    <Pressable
      onPress={() => speak(text)}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-full bg-gray-100 border border-gray-300"
      style={{ width: 48, height: 48 }}
    >
      <Ionicons name="volume-high" size={24} color="#111827" />
    </Pressable>
  );
}
