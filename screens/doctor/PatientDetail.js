import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import LevelLineChart, {
  ChartFooter,
  ChartLegend,
} from "../../components/LevelLineChart";
import StatusBadge from "../../components/StatusBadge";
import SymptomChart from "../../components/SymptomChart";
import {
  RANGE_HIGH,
  RANGE_LOW,
  getHistory,
  getSymptomLog,
  levelTone,
} from "../../data/history";
import { loadNote, saveNote } from "../../data/notes";

// Read-only clinician view of one patient. Same chart components as the
// patient side, so the two portals can never disagree about the data — but
// presented at normal density, not the patient portal's enlarged sizing.
export default function PatientDetail({ patient, onBack }) {
  const readings = getHistory(patient.id);
  const symptoms = getSymptomLog(patient.id);
  const [selected, setSelected] = useState(readings[readings.length - 1]);
  const [note, setNote] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  // Reload whenever the doctor opens a different patient. The `active` flag
  // drops a slow read if they switch again before it resolves, so one
  // patient's note can never land on another's record.
  useEffect(() => {
    let active = true;
    setSaveStatus("");
    setNote("");
    loadNote(patient.id).then((text) => {
      if (active) setNote(text);
    });
    return () => {
      active = false;
    };
  }, [patient.id]);

  async function handleSaveNote() {
    const ok = await saveNote(patient.id, note);
    setSaveStatus(ok ? "Saved" : "Could not save — try again");
  }

  const average = Math.round(
    readings.reduce((sum, r) => sum + r.level, 0) / readings.length
  );
  const inRange = readings.filter(
    (r) => r.level >= RANGE_LOW && r.level <= RANGE_HIGH
  ).length;
  const percentInRange = Math.round((inRange / readings.length) * 100);
  const days = [...new Set(readings.map((r) => r.day))];

  // The clinically interesting number: how bad symptoms get when the level
  // has drifted outside the therapeutic window.
  const outOfRange = symptoms.filter(
    (s) => s.level < RANGE_LOW || s.level > RANGE_HIGH
  );
  const worstOut = outOfRange.length
    ? Math.max(...outOfRange.map((s) => Math.max(s.stiffness, s.tremor)))
    : 0;

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
      <Text className="text-sm text-gray-500 mb-4">
        Age {patient.age} • Updated {patient.lastUpdated}
      </Text>

      {/* Summary */}
      <View className="flex-row bg-white rounded-xl border border-gray-200 mb-3">
        <Stat value={patient.level} label="Latest ng/mL" />
        <Stat value={average} label="Avg ng/mL" divider />
        <Stat value={`${percentInRange}%`} label="In range" divider />
        <Stat value={readings.length} label="Readings" divider />
      </View>

      <Section title="Device">
        <View className="flex-row items-center justify-between">
          <StatusBadge
            tone={patient.connected ? "good" : "bad"}
            label={patient.connected ? "Connected" : "Not connected"}
          />
          <Text className="text-sm text-gray-600">Battery {patient.batteryPct}%</Text>
        </View>
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

      {/* Level history — the trend is what's clinically useful */}
      <Section title="Level history">
        <ChartLegend />
        {selected ? (
          <Text className="text-sm text-gray-600 mb-2">
            Selected: <Text className="font-semibold">{selected.level} ng/mL</Text> •{" "}
            {selected.time} • {levelTone(selected.level).label}
          </Text>
        ) : null}
        <LevelLineChart
          data={readings}
          selectedId={selected ? selected.id : null}
          onSelect={setSelected}
        />
        <ChartFooter days={days} />
      </Section>

      <Section title="Reported symptoms">
        <SymptomChart entries={symptoms} />
      </Section>

      <Section title="Clinician notes">
        {/* Derived from the data, so it is kept separate from what the
            clinician writes and is never overwritten by it. */}
        <View className="flex-row bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
          <Ionicons name="information-circle" size={16} color="#6b7280" />
          <Text className="text-sm text-gray-600 ml-2 flex-1">
            {worstOut > 0
              ? `Symptoms reach ${worstOut}/4 when levels sit outside the 500–1500 ng/mL window.`
              : "Levels stayed within the therapeutic window across this period."}
          </Text>
        </View>

        <TextInput
          value={note}
          onChangeText={(text) => {
            setNote(text);
            setSaveStatus("");
          }}
          placeholder={`Notes for ${patient.name} — plan, dose changes, follow-up`}
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
          style={{ minHeight: 90 }}
        />

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-xs text-gray-500">
            {saveStatus || "Saved on this device, per patient"}
          </Text>
          <Pressable
            onPress={handleSaveNote}
            className="bg-gray-900 rounded-lg px-4 py-2"
          >
            <Text className="text-sm font-medium text-white">Save note</Text>
          </Pressable>
        </View>
      </Section>
    </ScrollView>
  );
}

function Stat({ value, label, divider }) {
  return (
    <View
      className={`flex-1 items-center py-3 ${divider ? "border-l border-gray-200" : ""}`}
    >
      <Text className="text-lg font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500 mt-0.5">{label}</Text>
    </View>
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
