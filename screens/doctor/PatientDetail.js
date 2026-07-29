import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import StatusBadge from "../../components/StatusBadge";

// Read-only clinician view of one patient. Normal sizing, like the roster.
export default function PatientDetail({ patient, onBack }) {
  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <Pressable onPress={onBack} className="flex-row items-center self-start mb-3">
        <Ionicons name="chevron-back" size={18} color="#374151" />
        <Text className="text-sm font-medium text-gray-700 ml-1">Back to patients</Text>
      </Pressable>

      <Text className="text-3xl font-bold text-gray-900">{patient.name}</Text>
      <Text className="text-sm text-gray-500 mb-5">
        Age {patient.age} • Updated {patient.lastUpdated}
      </Text>

      <Section title="Device">
        <Text className="text-sm text-gray-600">
          {patient.connected ? "Connected" : "Not connected"} • Battery{" "}
          {patient.batteryPct}%
        </Text>
      </Section>

      <Section title="Current level">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-end">
            <Text className="text-4xl font-bold text-gray-900">{patient.level}</Text>
            <Text className="text-base text-gray-500 ml-1 mb-1">{patient.unit}</Text>
          </View>
          <StatusBadge
            tone={patient.inRange ? "good" : "warn"}
            label={patient.inRange ? "In range" : "Out of range"}
          />
        </View>
      </Section>

      <Section title="Reported symptoms">
        <SymptomRow label="Stiffness" value={patient.stiffness} />
        <SymptomRow label="Tremor" value={patient.tremor} />
      </Section>

      <Section title="Clinician notes">
        <Text className="text-sm text-gray-600">
          No notes yet. Review levels and symptom trend before the next visit.
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
      <Text className="text-base font-semibold text-gray-900 mb-3">{title}</Text>
      {children}
    </View>
  );
}

function SymptomRow({ label, value }) {
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-medium text-gray-800">{label}</Text>
        <Text className="text-sm text-gray-500">{value}/4</Text>
      </View>
      <View className="h-2 rounded-full bg-gray-200">
        <View
          className="h-2 rounded-full bg-green-500"
          style={{ width: `${(value / 4) * 100}%` }}
        />
      </View>
    </View>
  );
}
