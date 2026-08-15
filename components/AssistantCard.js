import { Ionicons } from "@expo/vector-icons";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { SUGGESTIONS, availability, ask } from "../data/assistant";
import * as webllm from "../data/webllm";

// Ask-your-records panel.
//
// The engine ladder is visible rather than hidden. A patient is entitled to
// know whether the thing answering them is a language model on their own GPU,
// a smaller built-in one, or their records read back directly — and a
// several-hundred-megabyte download is never started without them asking for it.
const ENGINE_LABEL = {
  webllm: "Written by the on-device model from your own entries.",
  "prompt-api": "Written by this browser's built-in model from your own entries.",
  rules: "Read directly from your own entries.",
  refusal: "A fixed safety response, not generated.",
};

export default function AssistantCard({ patientId, embedded = false }) {
  const { scale, speak } = useContext(AccessibilityContext);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const [gpu, setGpu] = useState(null); // null = still checking
  const [promptApi, setPromptApi] = useState(null);
  const [engineState, setEngineState] = useState("none"); // none | loading | ready | error
  const [progress, setProgress] = useState(null);
  const [modelId, setModelId] = useState(webllm.DEFAULT_MODEL);
  const [error, setError] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  // Which engine produced the answer on screen, and why it was not the best
  // one available. Shown rather than swallowed.
  const [answeredBy, setAnsweredBy] = useState(null);
  const [degraded, setDegraded] = useState(null);
  const [streaming, setStreaming] = useState(false);

  const live = useRef(true);

  const start = useCallback(async (id) => {
    // Set before loading, not after: the status line names the model, and
    // claiming the wrong one is exactly the kind of quiet inaccuracy this panel
    // is supposed to avoid.
    setModelId(id);
    setEngineState("loading");
    setError("");
    setProgress({ fraction: 0, text: "Starting…" });
    try {
      await webllm.prepare(id, (p) => {
        if (live.current) setProgress(p);
      });
      if (!live.current) return;
      setEngineState("ready");
      setProgress(null);
      setShowOptions(false);
    } catch (e) {
      if (!live.current) return;
      setEngineState("error");
      setProgress(null);
      setError(
        e?.message?.slice(0, 160) ||
          "The model could not be loaded. Your records still answer questions below."
      );
    }
  }, []);

  useEffect(() => {
    live.current = true;

    (async () => {
      const [supported, builtIn] = await Promise.all([
        webllm.hasWebGPU(),
        availability(),
      ]);
      if (!live.current) return;
      setGpu(supported);
      setPromptApi(builtIn);

      if (webllm.ready()) {
        setEngineState("ready");
        setModelId(webllm.activeModel());
        return;
      }
      if (!supported) return;

      // Already downloaded and previously accepted: bring it back without
      // asking again. The weights come from cache, so this is quick and costs
      // no bandwidth.
      const { model, consented } = await webllm.savedChoice();
      if (!live.current || !consented) return;
      setModelId(model);
      if (await webllm.isCached(model)) {
        if (live.current) start(model);
      }
    })();

    return () => {
      live.current = false;
    };
  }, [start]);

  useEffect(() => {
    setAnswer("");
    setQuestion("");
    setAnsweredBy(null);
    setDegraded(null);
  }, [patientId]);

  async function send(text) {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setStreaming(false);
    setAnswer("");
    setAnsweredBy(null);
    setDegraded(null);
    try {
      // Deliberately NOT rendering partial tokens.
      //
      // Streaming raw output to the screen shows the model's text before the
      // safety filters have seen it. In testing, a small model produced "I've
      // been taking 1000 mg of levodopa 3 times a day" — a fabricated dose,
      // grounded in nothing in the record — and a streaming panel would have
      // displayed it in full before the guard discarded it. A patient who has
      // read that sentence has been misinformed regardless of what replaces it
      // a second later. The token callback only drives the progress indicator.
      const result = await ask(patientId, q, () => {
        if (live.current) setStreaming(true);
      });
      if (!live.current) return;
      setAnswer(result.text);
      setAnsweredBy(result.engine);
      setDegraded(result.degraded || null);
    } finally {
      if (live.current) {
        setBusy(false);
        setStreaming(false);
      }
    }
  }

  async function stop() {
    await webllm.interrupt();
  }

  async function release() {
    await webllm.unload();
    if (!live.current) return;
    setEngineState("none");
    setAnswer("");
  }

  const chosen = webllm.modelInfo(modelId);
  const status = describeEngine({ engineState, gpu, promptApi });

  return (
    <View
      style={
        embedded
          ? { backgroundColor: "transparent" }
          : {
              backgroundColor: "#ffffff",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#e2e8f0",
              padding: 20,
              marginBottom: 20,
            }
      }
    >
      {embedded ? null : (
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
      )}
      <Text
        style={{
          fontSize: 15 * scale,
          lineHeight: 21 * scale,
          color: "#475569",
          marginTop: 2,
        }}
      >
        Looks things up in what you have logged — symptoms, doses, meals,
        activity. It is not a doctor: it cannot tell you what a symptom means,
        what is causing it, or what to do about it.
      </Text>

      {/* Which engine is answering, always visible */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          backgroundColor: status.bg,
          borderRadius: 10,
          paddingVertical: 9,
          paddingHorizontal: 11,
          marginTop: 12,
        }}
      >
        <Ionicons name={status.icon} size={17} color={status.ink} />
        <Text
          style={{
            marginLeft: 7,
            flex: 1,
            minWidth: 0,
            fontSize: 13 * scale,
            lineHeight: 18 * scale,
            color: status.ink,
            fontWeight: "600",
          }}
        >
          {engineState === "ready"
            ? `Answering on this device with ${chosen.detail}. Nothing you ask is sent anywhere.`
            : status.label}
        </Text>
      </View>

      {/* Download consent. Never automatic — this is someone's data plan. */}
      {gpu && engineState === "none" ? (
        <View style={{ marginTop: 12 }}>
          {showOptions ? (
            <View>
              {webllm.MODELS.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => start(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Load ${m.label}, ${m.megabytes} megabytes`}
                  style={{
                    minHeight: 64,
                    justifyContent: "center",
                    paddingHorizontal: 14,
                    marginBottom: 8,
                    borderRadius: 12,
                    backgroundColor: "#f8fafc",
                    borderWidth: 2,
                    borderColor: "#cbd5e1",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16 * scale,
                      fontWeight: "700",
                      color: "#0f172a",
                    }}
                  >
                    {m.label} — {m.megabytes} MB
                  </Text>
                  <Text style={{ fontSize: 13 * scale, color: "#475569" }}>
                    {m.detail}
                  </Text>
                  {m.note ? (
                    <Text style={{ fontSize: 12.5 * scale, color: "#64748b" }}>
                      {m.note}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              <Text
                style={{
                  fontSize: 12.5 * scale,
                  lineHeight: 17 * scale,
                  color: "#64748b",
                }}
              >
                Downloaded once and kept on this device. After that it works with
                no connection at all.
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowOptions(true)}
              accessibilityRole="button"
              accessibilityLabel="Set up the on-device assistant"
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 60,
                paddingHorizontal: 15,
                borderRadius: 12,
                backgroundColor: "#eef2ff",
                borderWidth: 1,
                borderColor: "#c7d2fe",
              }}
            >
              <Ionicons name="hardware-chip" size={22} color="#3730a3" />
              <Text
                style={{
                  marginLeft: 9,
                  flex: 1,
                  minWidth: 0,
                  fontSize: 15 * scale,
                  lineHeight: 20 * scale,
                  fontWeight: "700",
                  color: "#3730a3",
                }}
              >
                Set up the on-device assistant for fuller answers
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Download progress */}
      {engineState === "loading" ? (
        <View style={{ marginTop: 12 }}>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.round((progress?.fraction || 0) * 100)}%`,
                height: 8,
                backgroundColor: "#4338ca",
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 12.5 * scale,
              color: "#475569",
              marginTop: 6,
            }}
            numberOfLines={2}
          >
            {progress?.text || "Preparing…"}
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text
          style={{
            fontSize: 13 * scale,
            lineHeight: 18 * scale,
            color: "#9a3412",
            marginTop: 10,
          }}
        >
          {error}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 14 }}>
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

      <View style={{ flexDirection: "row" }}>
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
        {busy && engineState === "ready" ? (
          <Pressable
            onPress={stop}
            accessibilityRole="button"
            accessibilityLabel="Stop generating"
            style={{
              minHeight: 56,
              paddingHorizontal: 18,
              marginLeft: 8,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: "#991b1b",
            }}
          >
            <Ionicons name="stop" size={20} color="#ffffff" />
          </Pressable>
        ) : (
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
                style={{
                  fontSize: 16 * scale,
                  fontWeight: "700",
                  color: "#ffffff",
                }}
              >
                Ask
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {busy ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: "#cbd5e1",
          }}
        >
          <ActivityIndicator color="#334155" />
          <Text
            style={{
              marginLeft: 10,
              fontSize: 15 * scale,
              color: "#475569",
            }}
          >
            {streaming
              ? "Writing, then checking it against your records…"
              : "Reading your records…"}
          </Text>
        </View>
      ) : null}

      {!busy && answer ? (
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
          <ScrollView style={{ maxHeight: 300 }}>
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

          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
            <Pressable
              onPress={() => speak(answer, "assistant-answer")}
              accessibilityRole="button"
              accessibilityLabel="Read this answer aloud"
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 44,
                paddingHorizontal: 12,
                marginRight: 8,
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

            {engineState === "ready" ? (
              <Pressable
                onPress={release}
                accessibilityRole="button"
                accessibilityLabel="Free the memory the model is using"
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
                <Ionicons name="power" size={18} color="#334155" />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 14 * scale,
                    fontWeight: "600",
                    color: "#334155",
                  }}
                >
                  Free memory
                </Text>
              </Pressable>
            ) : null}
          </View>

          {degraded ? (
            <Text
              style={{
                fontSize: 12.5 * scale,
                lineHeight: 17 * scale,
                color: "#9a3412",
                marginTop: 10,
              }}
            >
              {degraded} Answered from your records instead.
            </Text>
          ) : null}

          <Text
            style={{
              fontSize: 12 * scale,
              lineHeight: 17 * scale,
              color: "#64748b",
              marginTop: 10,
            }}
          >
            {ENGINE_LABEL[answeredBy] || "Built from your own entries."} Not
            medical advice, and never a reason to change your medication.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// The four honest states, in the order the ladder tries them.
function describeEngine({ engineState, gpu, promptApi }) {
  if (engineState === "loading") {
    return {
      label: "Loading the model onto this device…",
      icon: "cloud-download",
      bg: "#eef2ff",
      ink: "#3730a3",
    };
  }
  if (engineState === "ready") {
    return { label: "", icon: "shield-checkmark", bg: "#dcfce7", ink: "#166534" };
  }
  if (promptApi?.state === "available") {
    return {
      label:
        "Answering with this browser's built-in model. Nothing you ask is sent anywhere.",
      icon: "shield-checkmark",
      bg: "#dcfce7",
      ink: "#166534",
    };
  }
  if (gpu === null) {
    return {
      label: "Checking what this device can run…",
      icon: "ellipsis-horizontal",
      bg: "#f1f5f9",
      ink: "#475569",
    };
  }
  if (gpu === false) {
    return {
      label:
        "This device has no WebGPU, so answers are read straight from your records.",
      icon: "document-text",
      bg: "#f1f5f9",
      ink: "#475569",
    };
  }
  return {
    label: "Answers are read straight from your records.",
    icon: "document-text",
    bg: "#f1f5f9",
    ink: "#475569",
  };
}
