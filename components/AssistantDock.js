import { Ionicons } from "@expo/vector-icons";
import { useContext, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";
import AssistantCard from "./AssistantCard";
import { useWide } from "./layout";

// The assistant, docked in the corner of every patient screen.
//
// It lives here rather than inside a single screen because the questions it
// answers arrive while the patient is looking at something else — reading the
// chart on History, or halfway through logging a meal. Making them navigate to
// Help first is exactly the friction that stops a feature being used.
//
// Collapsed by default. A panel that opens itself would cover the reading a
// patient came to the screen to see.
const TAB_BAR_CLEARANCE = 78;

export default function AssistantDock() {
  const { role, user } = useContext(RoleContext);
  const { scale } = useContext(AccessibilityContext);
  const wide = useWide();
  const [open, setOpen] = useState(false);

  // Patient portal only. The assistant reads one person's records, and the
  // clinician portal has no single patient in scope at the roster level.
  if (role !== "patient" || !user) return null;

  // `position: fixed` pins the dock to the viewport so it survives the scroll
  // of whichever screen is mounted underneath. On native this falls back to
  // absolute, which is the correct behaviour there.
  const anchor = {
    position: Platform.OS === "web" ? "fixed" : "absolute",
    right: wide ? 24 : 12,
    bottom: TAB_BAR_CLEARANCE,
    zIndex: 60,
  };

  if (!open) {
    return (
      <View style={anchor} pointerEvents="box-none">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open the assistant and ask about your records"
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 56,
            paddingHorizontal: 18,
            borderRadius: 28,
            backgroundColor: "#0f172a",
            shadowColor: "#000",
            shadowOpacity: 0.22,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color="#ffffff" />
          <Text
            style={{
              marginLeft: 8,
              fontSize: 16 * scale,
              fontWeight: "700",
              color: "#ffffff",
            }}
          >
            Ask
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        ...anchor,
        left: wide ? undefined : 12,
        width: wide ? 420 : undefined,
        maxHeight: "76%",
        borderRadius: 20,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        shadowColor: "#000",
        shadowOpacity: 0.24,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 16,
          paddingRight: 8,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#e2e8f0",
          backgroundColor: "#f8fafc",
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={18} color="#334155" />
        <Text
          style={{
            marginLeft: 8,
            flex: 1,
            minWidth: 0,
            fontSize: 15 * scale,
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          Assistant
        </Text>
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close the assistant"
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 22,
          }}
        >
          <Ionicons name="close" size={22} color="#334155" />
        </Pressable>
      </View>

      {/* The card is reused verbatim rather than duplicated, so the docked and
          full-page versions can never drift apart in what they claim about
          which engine is answering. */}
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <AssistantCard patientId={user} embedded />
      </ScrollView>
    </View>
  );
}
