import { Pressable, Text, View } from "react-native";

// Large, tap-friendly replacement for the 0–4 slider. Sliders are hard to
// set precisely with a tremor; big discrete buttons (each ≥64px) are not.
const LABELS = ["None", "Slight", "Mild", "Moderate", "Severe"];

export default function SymptomStepper({ label, value, onChange }) {
  return (
    <View className="mb-6">
      <View className="flex-row items-baseline justify-between mb-3">
        <Text className="text-xl font-semibold text-gray-900">{label}</Text>
        <Text className="text-lg font-medium text-gray-700">{LABELS[value]}</Text>
      </View>

      <View className="flex-row">
        {[0, 1, 2, 3, 4].map((n) => {
          const active = n === value;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}: ${LABELS[n]}`}
              className={`flex-1 mx-1 rounded-2xl items-center justify-center ${
                active ? "bg-black" : "bg-gray-100 border border-gray-200"
              }`}
              style={{ minHeight: 64 }}
            >
              <Text
                className={`text-2xl font-bold ${active ? "text-white" : "text-gray-700"}`}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
