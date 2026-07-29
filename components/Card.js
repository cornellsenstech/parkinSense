import { Text, View } from "react-native";

// A white module with a heading. Every block on the patient screens uses this,
// so the page reads as separate cards instead of one long scroll.
export default function Card({ title, subtitle, children }) {
  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
      {title ? (
        <Text className="text-2xl font-bold text-gray-900">{title}</Text>
      ) : null}
      {subtitle ? (
        <Text className="text-base text-gray-600 mt-1">{subtitle}</Text>
      ) : null}
      <View className="mt-4">{children}</View>
    </View>
  );
}
