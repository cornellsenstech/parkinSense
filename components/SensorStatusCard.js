import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Text, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";

// A single slim line rather than a full card. The device is background
// information most of the time — it only needs to be prominent when something
// is wrong, which the colour and icon handle.
export default function SensorStatus({ isConnected, batteryPct }) {
  const { scale } = useContext(AccessibilityContext);
  const isReady = isConnected && batteryPct >= 20;

  const ink = !isConnected ? "#991b1b" : isReady ? "#166534" : "#9a3412";
  const bg = !isConnected ? "#fee2e2" : isReady ? "#dcfce7" : "#ffedd5";
  const icon = !isConnected ? "close-circle" : isReady ? "bluetooth" : "battery-half";

  const text = !isConnected
    ? "Sensor not connected"
    : isReady
    ? `Connected • Battery ${batteryPct}%`
    : `Connected • Battery ${batteryPct}% — please charge`;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <Ionicons name={icon} size={18} color={ink} />
      <Text
        style={{
          marginLeft: 8,
          fontSize: 16 * scale,
          fontWeight: "600",
          color: ink,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
