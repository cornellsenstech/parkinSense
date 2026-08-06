import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";
import { T } from "./theme";
import { requestRefill, sendQuestions } from "../data/messages";
import {
  QUESTION_PROMPTS,
  addQuestion,
  loadQuestions,
  openQuestions,
  removeQuestion,
  toggleAnswered,
} from "../data/notepad";

// Two things that are not messages but end up in the same conversation: the
// questions a patient means to ask at their next appointment, and a repeat
// prescription request.
//
// Both are deliberately kept out of the urgent message flow. A question for
// three weeks' time is not something a clinician should have to triage today,
// and a refill is routine — mixing either into the same queue as "my symptoms
// are much worse" is how the urgent ones stop being read as urgent.
export default function AppointmentNotepad({ patient }) {
  const { scale } = useContext(AccessibilityContext);
  const { reporter } = useContext(RoleContext);

  const [questions, setQuestions] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");

  const [showRefill, setShowRefill] = useState(false);
  const [medication, setMedication] = useState("");
  const [supplyLeft, setSupplyLeft] = useState("");
  const [pharmacy, setPharmacy] = useState("");

  useEffect(() => {
    let active = true;
    loadQuestions(patient.id).then((list) => {
      if (active) setQuestions(list);
    });
    return () => {
      active = false;
    };
  }, [patient.id]);

  async function add(text) {
    const entry = await addQuestion(patient.id, text, reporter);
    if (!entry) return;
    setQuestions(await loadQuestions(patient.id));
    setDraft("");
    setStatus("");
  }

  async function toggle(id) {
    await toggleAnswered(patient.id, id);
    setQuestions(await loadQuestions(patient.id));
  }

  async function remove(id) {
    await removeQuestion(patient.id, id);
    setQuestions(await loadQuestions(patient.id));
  }

  async function send() {
    const ok = await sendQuestions({
      patientId: patient.id,
      patientName: patient.name,
      questions,
      by: reporter,
    });
    setStatus(
      ok
        ? "Sent to your care team as one message"
        : "Nothing to send — add a question first"
    );
  }

  async function sendRefill() {
    const ok = await requestRefill({
      patientId: patient.id,
      patientName: patient.name,
      medication,
      supplyLeft,
      pharmacy,
      by: reporter,
    });
    setStatus(ok ? "Refill request sent" : "Could not send — please try again");
    if (ok) {
      setShowRefill(false);
      setMedication("");
      setSupplyLeft("");
      setPharmacy("");
    }
  }

  const outstanding = openQuestions(questions);
  const unused = QUESTION_PROMPTS.filter(
    (p) => !questions.some((q) => q.text === p)
  ).slice(0, 3);

  return (
    <View
      style={{
        backgroundColor: T.card ?? "#ffffff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        padding: 20,
        marginBottom: 20,
      }}
    >
      <Text
        style={{
          fontSize: 22 * scale,
          lineHeight: 28 * scale,
          fontWeight: "700",
          color: "#0f172a",
        }}
      >
        Questions for your next appointment
      </Text>
      <Text
        style={{
          fontSize: 15 * scale,
          lineHeight: 21 * scale,
          color: "#475569",
          marginTop: 2,
        }}
      >
        Write it down when you think of it. Appointments are short, and the
        question you had at 3am is hard to recall three weeks later.
      </Text>

      <View style={{ flexDirection: "row", marginTop: 14 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a question"
          placeholderTextColor="#64748b"
          accessibilityLabel="Type a question for your next appointment"
          onSubmitEditing={() => add(draft)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 56,
            paddingHorizontal: 12,
            fontSize: 17 * scale,
            color: "#0f172a",
            backgroundColor: "#ffffff",
            borderWidth: 2,
            borderColor: "#cbd5e1",
            borderRadius: 12,
          }}
        />
        <Pressable
          onPress={() => add(draft)}
          accessibilityRole="button"
          accessibilityLabel="Add this question"
          style={{
            minHeight: 56,
            paddingHorizontal: 18,
            marginLeft: 8,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: "#0f172a",
          }}
        >
          <Text
            style={{ fontSize: 16 * scale, fontWeight: "700", color: "#ffffff" }}
          >
            Add
          </Text>
        </Pressable>
      </View>

      {/* Prompts, not a fixed list — a blank notepad is the hardest thing to
          start from. */}
      {unused.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
          {unused.map((prompt) => (
            <Pressable
              key={prompt}
              onPress={() => add(prompt)}
              accessibilityRole="button"
              accessibilityLabel={`Add: ${prompt}`}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 12,
                marginRight: 8,
                marginBottom: 8,
                borderRadius: 20,
                backgroundColor: "#f1f5f9",
                borderWidth: 1,
                borderColor: "#cbd5e1",
              }}
            >
              <Text style={{ fontSize: 14 * scale, color: "#334155" }}>
                + {prompt}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {questions.map((q) => (
        <View
          key={q.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
          }}
        >
          {/* Ticked off rather than deleted, so it is still visible at the
              appointment that this one was already covered. */}
          <Pressable
            onPress={() => toggle(q.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: q.answered }}
            accessibilityLabel={`Mark answered: ${q.text}`}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={q.answered ? "checkbox" : "square-outline"}
              size={24}
              color={q.answered ? "#166534" : "#64748b"}
            />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 4 }}>
            <Text
              style={{
                fontSize: 16 * scale,
                lineHeight: 22 * scale,
                color: q.answered ? "#94a3b8" : "#0f172a",
                textDecorationLine: q.answered ? "line-through" : "none",
              }}
            >
              {q.text}
            </Text>
            <Text style={{ fontSize: 12 * scale, color: "#94a3b8" }}>
              Added {q.dateLabel}
              {q.by === "caregiver" ? " by caregiver" : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => remove(q.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remove: ${q.text}`}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </Pressable>
        </View>
      ))}

      {outstanding.length ? (
        <Pressable
          onPress={send}
          accessibilityRole="button"
          accessibilityLabel="Send these questions to my care team"
          style={{
            minHeight: 56,
            marginTop: 14,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            backgroundColor: "#0f766e",
          }}
        >
          <Text
            style={{ fontSize: 17 * scale, fontWeight: "700", color: "#ffffff" }}
          >
            Send {outstanding.length}{" "}
            {outstanding.length === 1 ? "question" : "questions"} ahead of the
            appointment
          </Text>
        </Pressable>
      ) : null}

      {/* Refills */}
      <View
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
        }}
      >
        <Text
          style={{
            fontSize: 18 * scale,
            fontWeight: "700",
            color: "#0f172a",
            marginBottom: 6,
          }}
        >
          Need a refill?
        </Text>

        {showRefill ? (
          <View>
            <RefillField
              label="Which medication?"
              value={medication}
              onChange={setMedication}
              placeholder="e.g. Sinemet 25/100"
              scale={scale}
            />
            <RefillField
              label="How much do you have left?"
              value={supplyLeft}
              onChange={setSupplyLeft}
              placeholder="e.g. 5 days"
              scale={scale}
            />
            <RefillField
              label="Which pharmacy?"
              value={pharmacy}
              onChange={setPharmacy}
              placeholder="Optional"
              scale={scale}
            />
            <Pressable
              onPress={sendRefill}
              accessibilityRole="button"
              accessibilityLabel="Send this refill request"
              style={{
                minHeight: 56,
                marginTop: 6,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                backgroundColor: "#7c3aed",
              }}
            >
              <Text
                style={{
                  fontSize: 17 * scale,
                  fontWeight: "700",
                  color: "#ffffff",
                }}
              >
                Send refill request
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowRefill(true)}
            accessibilityRole="button"
            accessibilityLabel="Request a refill"
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 60,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: "#f5f3ff",
              borderWidth: 1,
              borderColor: "#ddd6fe",
            }}
          >
            <Ionicons name="medkit" size={24} color="#7c3aed" />
            <Text
              style={{
                marginLeft: 10,
                flex: 1,
                minWidth: 0,
                fontSize: 17 * scale,
                fontWeight: "700",
                color: "#6d28d9",
              }}
            >
              Request a repeat prescription
            </Text>
          </Pressable>
        )}
      </View>

      {status ? (
        <Text
          style={{
            fontSize: 15 * scale,
            color: "#166534",
            fontWeight: "600",
            marginTop: 12,
          }}
        >
          {status}
        </Text>
      ) : null}
    </View>
  );
}

function RefillField({ label, value, onChange, placeholder, scale }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 15 * scale,
          fontWeight: "600",
          color: "#334155",
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        accessibilityLabel={label}
        style={{
          minHeight: 52,
          paddingHorizontal: 12,
          fontSize: 17 * scale,
          color: "#0f172a",
          backgroundColor: "#ffffff",
          borderWidth: 2,
          borderColor: "#cbd5e1",
          borderRadius: 12,
        }}
      />
    </View>
  );
}
