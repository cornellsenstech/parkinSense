import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";
import { removeEntry, saveEntry } from "../data/symptomLog";
import {
  SEVERITY_WORDS,
  SLEEP_OPTIONS,
  SYMPTOMS,
  emptyScores,
} from "../data/symptoms";
import { useWide } from "./layout";

const UNDO_SECONDS = 20;

// The full check-in: seven scored symptoms, sleep quality, and a free-text box
// for anything the fixed list does not cover. Rows are laid out two-up on a wide
// screen so the card stays roughly square instead of a very tall single column.
export default function SymptomForm({ patientId }) {
  const { scale } = useContext(AccessibilityContext);
  const { reporter } = useContext(RoleContext);
  const wide = useWide();

  const [scores, setScores] = useState(emptyScores);
  const [sleep, setSleep] = useState(null);
  const [note, setNote] = useState("");
  const [justSaved, setJustSaved] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const asCaregiver = reporter === "caregiver";

  async function handleSave() {
    const entry = await saveEntry(patientId, { scores, sleep, note, by: reporter });
    if (!entry) return;
    setJustSaved(entry);
    setNote("");
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setJustSaved(null), UNDO_SECONDS * 1000);
  }

  async function handleUndo() {
    if (!justSaved) return;
    clearTimeout(undoTimer.current);
    await removeEntry(patientId, justSaved.id);
    setJustSaved(null);
  }

  function setScore(id, value) {
    setScores((current) => ({ ...current, [id]: value }));
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
        {asCaregiver ? "How are they doing?" : "How are you feeling?"}
      </Text>
      <Text style={{ fontSize: 16 * scale, color: "#475569", marginTop: 2 }}>
        Tap a number for each. 0 is none, 4 is severe.
      </Text>

      {/* Two-up on a wide screen so the card is not one long column */}
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          flexWrap: wide ? "wrap" : "nowrap",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        {SYMPTOMS.map((symptom) => (
          <View
            key={symptom.id}
            style={{ width: wide ? "48.5%" : "100%", marginBottom: 14 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <Text
                style={{ fontSize: 16 * scale, fontWeight: "700", color: "#0f172a" }}
              >
                {symptom.label}
              </Text>
              <Text style={{ fontSize: 14 * scale, color: "#64748b" }}>
                {SEVERITY_WORDS[scores[symptom.id]]}
              </Text>
            </View>

            <View style={{ flexDirection: "row" }}>
              {[0, 1, 2, 3, 4].map((n) => {
                const active = scores[symptom.id] === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setScore(symptom.id, n)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${symptom.label}: ${SEVERITY_WORDS[n]}`}
                    style={{
                      flex: 1,
                      minHeight: 52,
                      marginRight: n === 4 ? 0 : 5,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 11,
                      backgroundColor: active ? symptom.colour : "#f1f5f9",
                      borderWidth: active ? 0 : 1,
                      borderColor: "#cbd5e1",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 17 * scale,
                        fontWeight: "700",
                        color: active ? "#ffffff" : "#475569",
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {/* Sleep is a quality, so faces rather than a severity scale */}
      <Text
        style={{
          fontSize: 16 * scale,
          fontWeight: "700",
          color: "#0f172a",
          marginTop: 2,
          marginBottom: 6,
        }}
      >
        Last night's sleep
      </Text>
      <View style={{ flexDirection: "row" }}>
        {SLEEP_OPTIONS.map((option, i) => {
          const active = sleep === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setSleep(active ? null : option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              style={{
                flex: 1,
                minHeight: 60,
                marginRight: i === SLEEP_OPTIONS.length - 1 ? 0 : 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: active ? option.colour : "#f1f5f9",
                borderWidth: active ? 0 : 1,
                borderColor: "#cbd5e1",
              }}
            >
              <Ionicons
                name={option.icon}
                size={24}
                color={active ? "#ffffff" : option.colour}
              />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14 * scale,
                  fontWeight: "700",
                  color: active ? "#ffffff" : "#475569",
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Anything the fixed list does not cover */}
      <Text
        style={{
          fontSize: 16 * scale,
          fontWeight: "700",
          color: "#0f172a",
          marginTop: 16,
          marginBottom: 6,
        }}
      >
        Anything else?
      </Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={
          asCaregiver
            ? "In their words, or what you noticed"
            : "In your own words"
        }
        placeholderTextColor="#64748b"
        multiline
        textAlignVertical="top"
        accessibilityLabel="Anything else"
        style={{
          minHeight: 84,
          padding: 12,
          fontSize: 17 * scale,
          lineHeight: 24 * scale,
          color: "#0f172a",
          backgroundColor: "#ffffff",
          borderWidth: 2,
          borderColor: "#cbd5e1",
          borderRadius: 14,
        }}
      />

      <Pressable
        onPress={handleSave}
        accessibilityRole="button"
        accessibilityLabel="Save this check-in"
        style={{
          minHeight: 56,
          marginTop: 12,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          backgroundColor: "#0f172a",
        }}
      >
        <Text style={{ fontSize: 18 * scale, fontWeight: "700", color: "#ffffff" }}>
          {asCaregiver ? "Save as caregiver" : "Save"}
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
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text
              style={{ fontSize: 18 * scale, fontWeight: "700", color: "#166534" }}
            >
              Saved at {justSaved.timeLabel}
            </Text>
            <Text style={{ fontSize: 15 * scale, color: "#166534" }}>
              Recorded by {justSaved.by === "caregiver" ? "caregiver" : "patient"}
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
