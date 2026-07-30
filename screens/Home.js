import { useContext, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import Card from "../components/Card";
import { column, columns, page, useWide } from "../components/layout";
import SensorStatus from "../components/SensorStatusCard";
import StatusBadge from "../components/StatusBadge";
import SymptomStepper from "../components/SymptomStepper";
import TodayTrend from "../components/TodayTrend";
import { describeTrend, getTodayTrend } from "../data/history";
import { removeEntry, saveEntry } from "../data/symptomLog";
import { patients } from "../data/patients";
import { RoleContext } from "../context/RoleContext";
import { AccessibilityContext } from "../context/AccessibilityContext";

// Someone recorded as "Dr. Alan Reed" should be greeted as Alan, not Dr.
const TITLES = ["mr", "mrs", "ms", "miss", "dr", "prof"];

function firstNameOf(fullName) {
  const parts = fullName.split(" ");
  const first = parts[0].replace(".", "").toLowerCase();
  return TITLES.includes(first) && parts.length > 1 ? parts[1] : parts[0];
}

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { user } = useContext(RoleContext);
  const { scale } = useContext(AccessibilityContext);
  const wide = useWide();
  const patient = patients.find((p) => p.id === user) || patients[0];
  const firstName = firstNameOf(patient.name);
  const greeting = greetingFor(new Date().getHours());

  const [stiffness, setStiffness] = useState(patient.stiffness);
  const [tremor, setTremor] = useState(patient.tremor);

  // What was just saved, so it can be undone. Holds the previous values too,
  // because undoing should put the controls back where they were.
  const [justSaved, setJustSaved] = useState(null);
  const [saveError, setSaveError] = useState("");
  const undoTimer = useRef(null);

  // A generous window — a tremor or a moment of hesitation should not cost you
  // the chance to correct a mis-tap.
  const UNDO_SECONDS = 20;

  useEffect(() => {
    return () => clearTimeout(undoTimer.current);
  }, []);

  async function handleSave() {
    const entry = await saveEntry(patient.id, { stiffness, tremor });
    if (!entry) {
      setSaveError("Could not save — please try again");
      return;
    }
    setSaveError("");
    setJustSaved({ entry, previous: { stiffness, tremor } });

    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setJustSaved(null), UNDO_SECONDS * 1000);
  }

  async function handleUndo() {
    if (!justSaved) return;
    clearTimeout(undoTimer.current);
    await removeEntry(patient.id, justSaved.entry.id);
    setStiffness(justSaved.previous.stiffness);
    setTremor(justSaved.previous.tremor);
    setJustSaved(null);
  }

  const trend = getTodayTrend(patient.id);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={page(undefined, 24)}
    >
      {/* Greeting and device on one compact line each, rather than two big
          blocks — the level below is what deserves the space. */}
      <Text
        style={{
          fontSize: 30 * scale,
          lineHeight: 36 * scale,
          fontWeight: "800",
          letterSpacing: -0.4,
          color: "#0f172a",
        }}
      >
        {greeting}, {firstName}
      </Text>
      <View style={{ marginTop: 10, marginBottom: 22 }}>
        <SensorStatus
          isConnected={patient.connected}
          batteryPct={patient.batteryPct}
        />
      </View>

      {/* Two columns on a wide screen so the page fills the space without any
          one card growing an over-long line. Stacks on a phone. */}
      <View style={columns(wide, 24)}>
      <View style={column(wide)}>

      {/* Current level */}
      <Card
        title="Your level"
        speakText={`Your level is ${patient.level} ng/mL, ${
          patient.inRange ? "in range" : "out of range"
        }. Updated ${patient.lastUpdated}.`}
      >
        <View className="flex-row items-end">
          <Text className="text-6xl font-bold text-gray-900">{patient.level}</Text>
          <Text className="text-2xl text-gray-600 ml-2 mb-2">{patient.unit}</Text>
        </View>
        <View className="mt-4">
          <StatusBadge
            tone={patient.inRange ? "good" : "warn"}
            label={patient.inRange ? "In range" : "Out of range"}
          />
        </View>
        <Text className="text-base text-gray-600 mt-4">
          Updated {patient.lastUpdated}
        </Text>
      </Card>

      {/* Trend */}
      <Card
        title="Today's trend"
        subtitle="Midnight to now, in 24 steps"
        speakText={`Today's trend. ${describeTrend(trend)}`}
      >
        <Text className="text-base text-gray-700 mb-4">{describeTrend(trend)}</Text>
        <TodayTrend points={trend} />
      </Card>

      </View>
      <View style={column(wide)}>

      {/* Symptom check-in */}
      <Card
        title="How are you feeling?"
        subtitle="Tap the level that fits — 0 is none, 4 is severe"
      >
        <SymptomStepper label="Stiffness" value={stiffness} onChange={setStiffness} />
        <SymptomStepper label="Tremor" value={tremor} onChange={setTremor} />

        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save today's symptoms"
          className="bg-black rounded-2xl items-center justify-center mt-2"
          style={{ minHeight: 56 }}
        >
          <Text className="text-white text-lg font-semibold">Save</Text>
        </Pressable>

        {/* Say plainly that it saved, and leave a way back. Without this the
            button appeared to do nothing at all. */}
        {justSaved ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#dcfce7",
              borderRadius: 16,
              padding: 14,
              marginTop: 12,
            }}
          >
            <Ionicons name="checkmark-circle" size={26} color="#166534" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text
                style={{
                  fontSize: 18 * scale,
                  fontWeight: "700",
                  color: "#166534",
                }}
              >
                Saved at {justSaved.entry.timeLabel}
              </Text>
              <Text style={{ fontSize: 15 * scale, color: "#166534" }}>
                Stiffness {justSaved.entry.stiffness}, tremor{" "}
                {justSaved.entry.tremor}
              </Text>
            </View>
            <Pressable
              onPress={handleUndo}
              accessibilityRole="button"
              accessibilityLabel="Undo this save"
              style={{
                minHeight: 52,
                paddingHorizontal: 18,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: "#ffffff",
                borderWidth: 2,
                borderColor: "#86efac",
              }}
            >
              <Text
                style={{
                  fontSize: 17 * scale,
                  fontWeight: "700",
                  color: "#166534",
                }}
              >
                Undo
              </Text>
            </Pressable>
          </View>
        ) : null}

        {saveError ? (
          <Text
            style={{
              marginTop: 12,
              fontSize: 17 * scale,
              fontWeight: "600",
              color: "#991b1b",
            }}
          >
            {saveError}
          </Text>
        ) : null}
      </Card>

      </View>
      </View>
    </ScrollView>
  );
}
