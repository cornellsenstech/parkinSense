import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

export default function SensorStatus({ isConnected, batteryPct }) {
  const isReady = isConnected && batteryPct >= 20;

  const color = !isConnected ? "#991b1b" : isReady ? "#166534" : "#9a3412";
  const icon = !isConnected ? "close-circle" : isReady ? "bluetooth" : "battery-half";
  const subText = isConnected
    ? `Battery ${batteryPct}% • ${isReady ? "Ready" : "Battery low — please charge"}`
    : "Make sure your sensor is nearby";

  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
      <View className="flex-row items-center">
        <Ionicons name={icon} size={28} color={color} />
        <Text className="text-2xl font-bold text-gray-900 ml-2">
          {isConnected ? "Connected" : "Not connected"}
        </Text>
      </View>
      <Text className="mt-2 text-lg text-gray-700">{subText}</Text>
    </View>
  );
}
