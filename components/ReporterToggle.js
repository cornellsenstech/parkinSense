import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Pressable, Text, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";

const MODES = [
  { id: "patient", label: "I'm the patient", icon: "person" },
  { id: "caregiver", label: "I'm the caregiver", icon: "people" },
];

// Sits at the top of the patient portal. Whoever is holding the phone says so
// once, and everything recorded afterwards is attributed to them.
export default function ReporterToggle() {
  const { reporter, setReporter } = useContext(RoleContext);
  const { scale } = useContext(AccessibilityContext);

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 16,
        padding: 4,
        marginBottom: 18,
      }}
    >
      {MODES.map((mode) => {
        const active = mode.id === reporter;
        return (
          <Pressable
            key={mode.id}
            onPress={() => setReporter(mode.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={mode.label}
            style={{
              flex: 1,
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: active ? "#0f172a" : "transparent",
            }}
          >
            <Ionicons
              name={mode.icon}
              size={20}
              color={active ? "#ffffff" : "#475569"}
            />
            <Text
              style={{
                marginLeft: 8,
                fontSize: 16 * scale,
                fontWeight: "700",
                color: active ? "#ffffff" : "#475569",
              }}
            >
              {mode.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
