import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

// Status is always an icon plus a word, never colour on its own, so it still
// reads for colour-blind and low-vision users.
const TONES = {
  good: { bg: "bg-green-100", fg: "#166534", icon: "checkmark-circle" },
  warn: { bg: "bg-orange-100", fg: "#9a3412", icon: "alert-circle" },
  bad: { bg: "bg-red-100", fg: "#991b1b", icon: "close-circle" },
  neutral: { bg: "bg-gray-200", fg: "#374151", icon: "remove-circle" },
};

export default function StatusBadge({ tone, label }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <View className={`self-start flex-row items-center rounded-full ${t.bg} px-4 py-2`}>
      <Ionicons name={t.icon} size={20} color={t.fg} />
      <Text className="text-base font-semibold ml-2" style={{ color: t.fg }}>
        {label}
      </Text>
    </View>
  );
}
