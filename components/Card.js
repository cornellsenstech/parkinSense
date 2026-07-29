import { useContext } from "react";
import { Text, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import SpeakButton from "./SpeakButton";

// A white module with a heading. Every block on the patient screens uses this,
// so the page reads as separate cards instead of one long scroll.
//
// `speakText` is what the read-aloud button says for this card. Passing it also
// makes the speaker appear, so a card is only speakable if it has been given
// something sensible to say.
export default function Card({ title, subtitle, speakText, children }) {
  const { scale } = useContext(AccessibilityContext);

  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          {title ? (
            <Text
              className="font-bold text-gray-900"
              style={{ fontSize: 24 * scale, lineHeight: 30 * scale }}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              className="text-gray-600 mt-1"
              style={{ fontSize: 16 * scale, lineHeight: 22 * scale }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <SpeakButton text={speakText || `${title || ""}. ${subtitle || ""}`} />
      </View>
      <View className="mt-4">{children}</View>
    </View>
  );
}
