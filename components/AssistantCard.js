import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { SUGGESTIONS, availability, ask } from "../data/assistant";

// Ask-your-records panel, backed by an on-device language model.
//
// The status line is not decoration. A patient is entitled to know whether the
// thing answering them is running on their own machine, and the three states —
// on-device model ready, model downloading, no model so answering from the
// records directly — are visibly different rather than silently interchangeable.
export default function AssistantCard({ patientId }) {
  const { scale, speak } = useContext(AccessibilityContext);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    availability().then((state) => {
      if (live.current) setEngine(state);
    });
    return () => {
      live.current = false;
    };
  }, []);

  // A new patient means a new set of records; nothing from the last one should
  // stay on screen.
  useEffect(() => {
    setAnswer("");
    setQuestion("");
  }, [patientId]);

  async function send(text) {
    const q = (text ?? question).trim();
    if (!q || busy) return;

    setBusy(true);
    setAnswer("");
    try {
      const final = await ask(patientId, q, (partial) => {
        if (live.current) setAnswer(partial);
      });
      if (live.current) setAnswer(final);
    } finally {
      if (live.current) setBusy(false);
    }
  }

  const status = engineStatus(engine);

  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        padding: 20,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 22 * scale,
              lineHeight: 28 * scale,
              fontWeight: "700",
              color: "#0f172a",
            }}
          >
            Ask about your records
          </Text>
          <Text
            style={{
              fontSize: 15 * scale,
              lineHeight: 21 * scale,
              color: "#475569",
              marginTop: 2,
            }}
          >
            Questions about what you have logged — symptoms, doses, meals,
            activity. It cannot give medical advice.
          </Text>
        </View>
      </View>

      {/* Where the answer is computed, stated plainly. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: status.bg,
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginTop: 12,
        }}
      >
        <Ionicons name={status.icon} size={16} color={status.ink} />
        <Text
          style={{
            marginLeft: 6,
            flex: 1,
            minWidth: 0,
            fontSize: 13 * scale,
            lineHeight: 18 * scale,
            color: status.ink,
            fontWeight: "600",
          }}
        >
          {status.label}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              setQuestion(s);
              send(s);
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={s}
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
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 14 * scale, color: "#334155" }}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: "row", marginTop: 4 }}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="Type a question"
          placeholderTextColor="#64748b"
          onSubmitEditing={() => send()}
          accessibilityLabel="Ask a question about your records"
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
          onPress={() => send()}
          disabled={busy || !question.trim()}
          accessibilityRole="button"
          accessibilityLabel="Ask"
          style={{
            minHeight: 56,
            paddingHorizontal: 20,
            marginLeft: 8,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: busy || !question.trim() ? "#94a3b8" : "#0f172a",
          }}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text
              style={{ fontSize: 16 * scale, fontWeight: "700", color: "#ffffff" }}
            >
              Ask
            </Text>
          )}
        </Pressable>
      </View>

      {answer ? (
        <View
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: "#cbd5e1",
          }}
        >
          <ScrollView style={{ maxHeight: 280 }}>
            <Text
              style={{
                fontSize: 16 * scale,
                lineHeight: 24 * scale,
                color: "#0f172a",
              }}
            >
              {answer}
            </Text>
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Pressable
              onPress={() => speak(answer, "assistant-answer")}
              accessibilityRole="button"
              accessibilityLabel="Read this answer aloud"
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 44,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: "#ffffff",
                borderWidth: 1,
                borderColor: "#cbd5e1",
              }}
            >
              <Ionicons name="volume-high" size={18} color="#334155" />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 14 * scale,
                  fontWeight: "600",
                  color: "#334155",
                }}
              >
                Read aloud
              </Text>
            </Pressable>
          </View>

          <Text
            style={{
              fontSize: 12 * scale,
              lineHeight: 17 * scale,
              color: "#64748b",
              marginTop: 10,
            }}
          >
            Built from your own entries. Not medical advice, and never a reason
            to change your medication.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function engineStatus(engine) {
  if (!engine) {
    return { label: "Checking for an on-device model…", icon: "ellipsis-horizontal", bg: "#f1f5f9", ink: "#475569" };
  }
  if (engine.state === "available") {
    return {
      label: "Answering on this device. Nothing you ask is sent anywhere.",
      icon: "shield-checkmark",
      bg: "#dcfce7",
      ink: "#166534",
    };
  }
  if (engine.state === "downloading" || engine.state === "downloadable") {
    return {
      label: "The on-device model is still downloading. Answers come straight from your records until it is ready.",
      icon: "cloud-download",
      bg: "#ffedd5",
      ink: "#9a3412",
    };
  }
  return {
    label:
      engine.reason ||
      "No on-device model here, so answers are read straight from your records.",
    icon: "document-text",
    bg: "#f1f5f9",
    ink: "#475569",
  };
}
