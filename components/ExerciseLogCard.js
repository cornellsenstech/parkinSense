import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";
import {
  ACTIVITY_PRESETS,
  DURATIONS,
  INTENSITIES,
  WHEN_OPTIONS,
  exerciseSummary,
  loadExercise,
  removeExercise,
  saveExercise,
} from "../data/exerciseLog";
import { parseTime } from "../data/mealLog";

const UNDO_SECONDS = 20;

// Logging activity, built to the same shape as the meal card so the two read as
// a pair: presets for speed, free text underneath, quick time offsets, and an
// undo rather than a confirmation dialog.
export default function ExerciseLogCard({ patientId }) {
  const { scale } = useContext(AccessibilityContext);
  const { reporter } = useContext(RoleContext);

  const [entries, setEntries] = useState([]);
  const [activity, setActivity] = useState("");
  const [level, setLevel] = useState("moderate");
  const [minutes, setMinutes] = useState(30);
  const [when, setWhen] = useState("now");
  const [timeText, setTimeText] = useState("");
  const [justSaved, setJustSaved] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  useEffect(() => {
    let active = true;
    loadExercise(patientId).then((list) => {
      if (active) setEntries(list);
    });
    return () => {
      active = false;
    };
  }, [patientId]);

  const summary = exerciseSummary(entries, 7);
  const typedMinute = parseTime(timeText);

  async function handleSave() {
    const option = WHEN_OPTIONS.find((o) => o.id === when) || WHEN_OPTIONS[0];
    const entry = await saveExercise(patientId, {
      activity,
      level,
      minutes,
      minutesAgo: option.minutesAgo,
      atMinuteOfDay: typedMinute ?? undefined,
      by: reporter,
    });
    if (!entry) return;

    setEntries(await loadExercise(patientId));
    setJustSaved(entry);
    setActivity("");
    setTimeText("");
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setJustSaved(null), UNDO_SECONDS * 1000);
  }

  async function handleUndo() {
    if (!justSaved) return;
    clearTimeout(undoTimer.current);
    await removeExercise(patientId, justSaved.id);
    setEntries(await loadExercise(patientId));
    setJustSaved(null);
  }

  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
      <Text
        style={{
          fontSize: 24 * scale,
          lineHeight: 30 * scale,
          fontWeight: "700",
          color: "#0f172a",
        }}
      >
        Movement and exercise
      </Text>
      <Text
        style={{
          fontSize: 16 * scale,
          lineHeight: 22 * scale,
          color: "#475569",
          marginTop: 2,
        }}
      >
        Activity is the one thing outside medication with good evidence behind it
        in Parkinson's. Logging it here shows whether your better days are your
        active ones.
      </Text>

      {summary.sessions ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f0fdf4",
            borderRadius: 14,
            padding: 12,
            marginTop: 12,
          }}
        >
          <Ionicons name="walk" size={24} color="#166534" />
          <Text
            style={{
              marginLeft: 8,
              flex: 1,
              minWidth: 0,
              fontSize: 15 * scale,
              lineHeight: 21 * scale,
              color: "#166534",
              fontWeight: "600",
            }}
          >
            Active on {summary.activeDays} of the last 7 days —{" "}
            {summary.totalMinutes} minutes in total.
          </Text>
        </View>
      ) : null}

      <Field label="What did you do?" scale={scale}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {ACTIVITY_PRESETS.map((preset) => {
            const active = activity.trim().toLowerCase() === preset.toLowerCase();
            return (
              <Pressable
                key={preset}
                onPress={() => setActivity(active ? "" : preset)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={preset}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  marginRight: 8,
                  marginBottom: 8,
                  borderRadius: 22,
                  backgroundColor: active ? "#0f172a" : "#f1f5f9",
                  borderWidth: 1,
                  borderColor: active ? "#0f172a" : "#cbd5e1",
                }}
              >
                <Text
                  style={{
                    fontSize: 15 * scale,
                    fontWeight: "600",
                    color: active ? "#ffffff" : "#334155",
                  }}
                >
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={activity}
          onChangeText={setActivity}
          placeholder="Or type anything else"
          placeholderTextColor="#64748b"
          accessibilityLabel="What activity did you do"
          style={{
            minHeight: 52,
            marginTop: 2,
            paddingHorizontal: 12,
            fontSize: 17 * scale,
            color: "#0f172a",
            backgroundColor: "#ffffff",
            borderWidth: 2,
            borderColor: "#cbd5e1",
            borderRadius: 12,
          }}
        />
      </Field>

      <Field label="How hard was it?" scale={scale}>
        {INTENSITIES.map((option) => {
          const active = level === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setLevel(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label}. ${option.example}`}
              style={{
                minHeight: 64,
                justifyContent: "center",
                paddingHorizontal: 14,
                marginBottom: 8,
                borderRadius: 14,
                backgroundColor: active ? option.colour : "#f8fafc",
                borderWidth: 2,
                borderColor: active ? option.colour : "#cbd5e1",
              }}
            >
              <Text
                style={{
                  fontSize: 17 * scale,
                  fontWeight: "700",
                  color: active ? option.ink : "#0f172a",
                }}
              >
                {option.label}
              </Text>
              <Text
                style={{
                  fontSize: 14 * scale,
                  color: active ? option.ink : "#475569",
                }}
              >
                {option.example}
              </Text>
            </Pressable>
          );
        })}
      </Field>

      <Field label="For how long?" scale={scale}>
        <View style={{ flexDirection: "row" }}>
          {DURATIONS.map((value, i) => {
            const active = minutes === value;
            return (
              <Pressable
                key={value}
                onPress={() => setMinutes(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${value} minutes`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 56,
                  marginRight: i === DURATIONS.length - 1 ? 0 : 6,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: active ? "#0f172a" : "#f1f5f9",
                  borderWidth: active ? 0 : 1,
                  borderColor: "#cbd5e1",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 16 * scale,
                    fontWeight: "700",
                    color: active ? "#ffffff" : "#334155",
                  }}
                >
                  {value}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11 * scale,
                    color: active ? "#e2e8f0" : "#64748b",
                  }}
                >
                  min
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="When?" scale={scale}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {WHEN_OPTIONS.map((option) => {
            const active = when === option.id && !typedMinute;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  setWhen(option.id);
                  setTimeText("");
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                  marginRight: 8,
                  marginBottom: 8,
                  borderRadius: 12,
                  backgroundColor: active ? "#0f172a" : "#f1f5f9",
                  borderWidth: 1,
                  borderColor: active ? "#0f172a" : "#cbd5e1",
                }}
              >
                <Text
                  style={{
                    fontSize: 15 * scale,
                    fontWeight: "600",
                    color: active ? "#ffffff" : "#334155",
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={timeText}
          onChangeText={setTimeText}
          placeholder="Or type a time, e.g. 9:30 am"
          placeholderTextColor="#64748b"
          accessibilityLabel="Time of the activity"
          style={{
            minHeight: 52,
            paddingHorizontal: 12,
            fontSize: 17 * scale,
            color: "#0f172a",
            backgroundColor: "#ffffff",
            borderWidth: 2,
            borderColor: typedMinute ? "#0f172a" : "#cbd5e1",
            borderRadius: 12,
          }}
        />
      </Field>

      <Pressable
        onPress={handleSave}
        accessibilityRole="button"
        accessibilityLabel="Save this activity"
        style={{
          minHeight: 56,
          marginTop: 4,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          backgroundColor: "#0f172a",
        }}
      >
        <Text style={{ fontSize: 18 * scale, fontWeight: "700", color: "#ffffff" }}>
          Save activity
        </Text>
      </Pressable>

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
          <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 17 * scale, fontWeight: "700", color: "#166534" }}
            >
              {justSaved.activity}, {justSaved.minutes} min
            </Text>
            <Text style={{ fontSize: 14 * scale, color: "#166534" }}>
              Logged at {justSaved.timeLabel}
            </Text>
          </View>
          <Pressable
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo this activity"
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
              style={{ fontSize: 17 * scale, fontWeight: "700", color: "#166534" }}
            >
              Undo
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Field({ label, scale, children }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          fontSize: 16 * scale,
          fontWeight: "700",
          color: "#0f172a",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}
