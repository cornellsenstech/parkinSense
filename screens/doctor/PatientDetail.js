import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import StatusBadge from "../../components/StatusBadge";
import CombinedChart from "../../components/CombinedChart";
import { WIDE_WIDTH, page } from "../../components/layout";
import {
  RANGE_HIGH,
  RANGE_LOW,
  getHistory,
  getSymptomLog,
} from "../../data/history";
import { loadNote, saveNote } from "../../data/notes";

// Read-only clinician view of one patient. Same chart components as the
// patient side, so the two portals can never disagree about the data — but
// presented at normal density, not the patient portal's enlarged sizing.
export default function PatientDetail({ patient, onBack }) {
  const readings = getHistory(patient.id);
  const symptoms = getSymptomLog(patient.id);
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

  // An observation built from this patient's own numbers. Cites the actual
  // lowest and highest readings and when they happened, so two patients never
  // get the same sentence.
  const lowest = readings.reduce((a, b) => (b.level < a.level ? b : a));
  const highest = readings.reduce((a, b) => (b.level > a.level ? b : a));
  const belowCount = readings.filter((r) => r.level < RANGE_LOW).length;
  const aboveCount = readings.filter((r) => r.level > RANGE_HIGH).length;

  const observation = buildObservation({
    percentInRange,
    lowest,
    highest,
    belowCount,
    aboveCount,
    symptoms,
  });

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={page(WIDE_WIDTH)}
    >
      {/* A proper button, not a small text link — this is the only way out of a
          patient record, and it has to be obvious. */}
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to all patients"
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          minHeight: 44,
          paddingHorizontal: 14,
          marginBottom: 16,
          borderRadius: 10,
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: "#cbd5e1",
        }}
      >
        <Ionicons name="arrow-back" size={18} color="#0f172a" />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 14,
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          All patients
        </Text>
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

      {/* Levels and symptoms together — the correlation is the point, and it
          cannot be read from two separate charts. */}
      <Section title="Levels and symptoms together">
        <CombinedChart readings={readings} symptoms={symptoms} />
        <Text className="text-xs text-gray-500 mt-2">
          Dashed lines are symptom scores on the right axis. Solid line is
          concentration on the left.
        </Text>
      </Section>

      <Section title="Clinician notes">
        {/* Derived from the data, so it is kept separate from what the
            clinician writes and is never overwritten by it. */}
        <View className="flex-row bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
          <Ionicons name="information-circle" size={16} color="#6b7280" />
          <Text className="text-sm text-gray-600 ml-2 flex-1">{observation}</Text>
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

// Picks out whichever pattern this patient's data actually shows, and names
// the real numbers behind it. Ordered so the more urgent pattern wins when a
// patient drifts both ways.
function buildObservation({
  percentInRange,
  lowest,
  highest,
  belowCount,
  aboveCount,
  symptoms,
}) {
  const parts = [`${percentInRange}% of readings were inside the window.`];

  if (aboveCount > 0) {
    parts.push(
      `Peaked at ${highest.level} ng/mL (${highest.time}), above 1500 on ${aboveCount} reading${
        aboveCount === 1 ? "" : "s"
      } — dyskinesia risk.`
    );
  }

  if (belowCount > 0) {
    parts.push(
      `Dropped to ${lowest.level} ng/mL (${lowest.time}), below 500 on ${belowCount} reading${
        belowCount === 1 ? "" : "s"
      }.`
    );
  }

  if (aboveCount === 0 && belowCount === 0) {
    parts.push(
      `Stayed between ${lowest.level} and ${highest.level} ng/mL throughout.`
    );
  }

  // Tie the symptoms to the levels, which is the point of the pairing.
  const outOfRange = symptoms.filter((s) => s.level < 500 || s.level > 1500);
  if (outOfRange.length) {
    const worst = Math.max(
      ...outOfRange.map((s) => Math.max(s.stiffness, s.tremor))
    );
    parts.push(`Symptoms reached ${worst}/4 during those periods.`);
  }

  return parts.join(" ");
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
