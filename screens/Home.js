import { useContext, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Card from "../components/Card";
import { READING_WIDTH, page } from "../components/layout";
import SensorStatus from "../components/SensorStatusCard";
import StatusBadge from "../components/StatusBadge";
import SymptomStepper from "../components/SymptomStepper";
import TodayTrend from "../components/TodayTrend";
import { describeTrend, getTodayTrend } from "../data/history";
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
  const patient = patients.find((p) => p.id === user) || patients[0];
  const firstName = firstNameOf(patient.name);
  const greeting = greetingFor(new Date().getHours());

  const [stiffness, setStiffness] = useState(patient.stiffness);
  const [tremor, setTremor] = useState(patient.tremor);

  const trend = getTodayTrend(patient.id);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={page(READING_WIDTH, 24)}
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

      {/* Symptom check-in */}
      <Card
        title="How are you feeling?"
        subtitle="Tap the level that fits — 0 is none, 4 is severe"
      >
        <SymptomStepper label="Stiffness" value={stiffness} onChange={setStiffness} />
        <SymptomStepper label="Tremor" value={tremor} onChange={setTremor} />

        <Pressable
          onPress={() => console.log("Saved:", { user, stiffness, tremor })}
          accessibilityRole="button"
          accessibilityLabel="Save today's symptoms"
          className="bg-black rounded-2xl items-center justify-center mt-2"
          style={{ minHeight: 56 }}
        >
          <Text className="text-white text-lg font-semibold">Save</Text>
        </Pressable>
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
    </ScrollView>
  );
}
