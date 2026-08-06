import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";
import { removeEntry, saveEntry } from "../data/symptomLog";
import {
  SEVERITY_WORDS,
  SLEEP_OPTIONS,
  SYMPTOM_GROUPS,
  emptyScores,
  symptomsInGroup,
} from "../data/symptoms";

const UNDO_SECONDS = 20;

// The full check-in: ten scored symptoms in three groups, sleep quality, and a
// free-text box for anything the fixed list does not cover. One symptom per
// row, stacked, so the card reads straight down.
export default function SymptomForm({ patientId }) {
  const { scale } = useContext(AccessibilityContext);
  const { reporter } = useContext(RoleContext);

  const [scores, setScores] = useState(emptyScores);
  const [sleep, setSleep] = useState(null);
  const [note, setNote] = useState("");
  const [showHelp, setShowHelp] = useState(true);
  const [justSaved, setJustSaved] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const asCaregiver = reporter === "caregiver";

  // Clearing the form when the reporter changes is the whole point of having a
  // reporter. Previously the scores stayed on screen after a save, so switching
  // to caregiver showed the patient's own answers already filled in — it looked
  // like the caregiver was editing the patient's entry rather than recording a
  // separate observation, which is exactly the distinction this app exists to
  // preserve.
  useEffect(() => {
    reset();
    setJustSaved(null);
    clearTimeout(undoTimer.current);
  }, [reporter, patientId]);

  function reset() {
    setScores(emptyScores());
    setSleep(null);
    setNote("");
  }

  async function handleSave() {
    const entry = await saveEntry(patientId, { scores, sleep, note, by: reporter });
    if (!entry) return;
    setJustSaved(entry);
    // A fresh form after saving, so the next check-in — by either person — starts
    // from zero rather than from someone else's answers.
    reset();
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
        Tap a number for each one. Every scale runs the same way: 0 is none, 4 is
        severe.
      </Text>

      {/* Descriptions are on by default. Somebody rating "extra movements" out
          of four needs to know what is being asked before the number means
          anything — but once that is familiar it is just noise, so it can be
          turned off. */}
      <Pressable
        onPress={() => setShowHelp((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showHelp }}
        accessibilityLabel={
          showHelp ? "Hide what each symptom means" : "Show what each symptom means"
        }
        style={{
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          minHeight: 44,
          paddingHorizontal: 12,
          marginTop: 10,
          borderRadius: 10,
          backgroundColor: showHelp ? "#e2e8f0" : "#f8fafc",
          borderWidth: 1,
          borderColor: "#cbd5e1",
        }}
      >
        <Ionicons
          name={showHelp ? "eye-off-outline" : "help-circle-outline"}
          size={18}
          color="#334155"
        />
        <Text
          style={{
            marginLeft: 6,
            fontSize: 14 * scale,
            fontWeight: "600",
            color: "#334155",
          }}
        >
          {showHelp ? "Hide what these mean" : "What do these mean?"}
        </Text>
      </Pressable>

      {SYMPTOM_GROUPS.map((group) => (
        <View key={group} style={{ marginTop: 18 }}>
          <Text
            style={{
              fontSize: 12 * scale,
              fontWeight: "800",
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 10,
            }}
          >
            {group}
          </Text>

          {symptomsInGroup(group).map((symptom) => (
            <View key={symptom.id} style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 17 * scale,
                  fontWeight: "700",
                  color: "#0f172a",
                }}
              >
                {symptom.label}
              </Text>
              {showHelp ? (
                <Text
                  style={{
                    fontSize: 14 * scale,
                    lineHeight: 20 * scale,
                    color: "#475569",
                    marginTop: 2,
                  }}
                >
                  {symptom.description}
                </Text>
              ) : null}

              {/* The number and its word live inside the same button. Showing
                  the selected word off to one side made "None" look like a
                  label for the 4 sitting underneath it. */}
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                {[0, 1, 2, 3, 4].map((n) => {
                  const active = scores[symptom.id] === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setScore(symptom.id, n)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${symptom.label}: ${n}, ${SEVERITY_WORDS[n]}`}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 58,
                        marginRight: n === 4 ? 0 : 5,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 2,
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
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 10 * scale,
                          fontWeight: "600",
                          marginTop: 1,
                          color: active ? "#ffffff" : "#64748b",
                        }}
                      >
                        {SEVERITY_WORDS[n]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ))}

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
                minWidth: 0,
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
                numberOfLines={1}
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
          <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
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
