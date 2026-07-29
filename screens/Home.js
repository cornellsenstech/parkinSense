import { useContext, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Card from "../components/Card";
import SensorStatus from "../components/SensorStatusCard";
import StatusBadge from "../components/StatusBadge";
import SymptomStepper from "../components/SymptomStepper";
import TodayTrend from "../components/TodayTrend";
import { describeTrend, getTodayTrend } from "../data/history";
import { patients } from "../data/patients";
import { RoleContext } from "../context/RoleContext";

export default function Home() {
  const { user } = useContext(RoleContext);
  const patient = patients.find((p) => p.id === user) || patients[0];
  const firstName = patient.name.split(" ")[0];

  const [stiffness, setStiffness] = useState(patient.stiffness);
  const [tremor, setTremor] = useState(patient.tremor);

  const trend = getTodayTrend(patient.id);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
    >
      {/* Greeting */}
      <View className="mb-6">
        <Text className="text-2xl text-gray-600">Good afternoon,</Text>
        <Text className="text-5xl font-black text-gray-900">{firstName}</Text>
      </View>

      {/* Device */}
      <SensorStatus isConnected={patient.connected} batteryPct={patient.batteryPct} />

      {/* Current level */}
      <Card title="Your level">
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
      <Card title="Today's trend" subtitle="Midnight to now, in 24 steps">
        <Text className="text-base text-gray-700 mb-4">{describeTrend(trend)}</Text>
        <TodayTrend points={trend} />
      </Card>
    </ScrollView>
  );
}
