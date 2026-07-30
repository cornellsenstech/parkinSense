import { useContext, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import StatusBadge from "../../components/StatusBadge";
import { WIDE_WIDTH, page } from "../../components/layout";
import { DOCTOR_NAME, patients } from "../../data/patients";
import { RoleContext } from "../../context/RoleContext";
import PatientDetail from "./PatientDetail";

// Doctors scan many patients at once, so this side stays at normal density —
// none of the enlarged type used on the patient screens.
const BADGES = {
  stable: { tone: "good", label: "In range" },
  attention: { tone: "warn", label: "Needs attention" },
  offline: { tone: "neutral", label: "Sensor offline" },
};

export default function DoctorHome() {
  const [selectedId, setSelectedId] = useState(null);
  const { setRole } = useContext(RoleContext);

  const selected = patients.find((p) => p.id === selectedId);
  if (selected) {
    return <PatientDetail patient={selected} onBack={() => setSelectedId(null)} />;
  }

  const needAttention = patients.filter((p) => p.status === "attention").length;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={page(WIDE_WIDTH)}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-3xl font-bold text-gray-900">Patients</Text>
        <Pressable
          onPress={() => setRole(null)}
          className="rounded-lg bg-gray-200 px-3 py-2"
        >
          <Text className="text-sm font-medium text-gray-700">Switch portal</Text>
        </Pressable>
      </View>
      <Text className="text-sm text-gray-500 mb-5">
        {DOCTOR_NAME} • {patients.length} patients • {needAttention} need attention
      </Text>

      {patients.map((patient) => {
        const badge = BADGES[patient.status];
        return (
          <Pressable
            key={patient.id}
            onPress={() => setSelectedId(patient.id)}
            className="bg-white rounded-xl border border-gray-200 p-4 mb-3"
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-semibold text-gray-900">{patient.name}</Text>
              <Text className="text-xs text-gray-500">{patient.lastUpdated}</Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-end">
                <Text className="text-2xl font-bold text-gray-900">{patient.level}</Text>
                <Text className="text-sm text-gray-500 ml-1 mb-0.5">{patient.unit}</Text>
              </View>
              <StatusBadge tone={badge.tone} label={badge.label} />
            </View>

            <Text className="text-sm text-gray-600 mt-3">
              Stiffness {patient.stiffness}/4 • Tremor {patient.tremor}/4
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
