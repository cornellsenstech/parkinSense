import { Ionicons } from "@expo/vector-icons";
import { useCallback, useContext, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import SpeakButton from "../components/SpeakButton";
import { column, columns, page, useWide } from "../components/layout";
import { T, sectionLabel } from "../components/theme";
import {
  QUICK_MESSAGES,
  addTurn,
  getConversationsFor,
  lastTurn,
  startConversation,
} from "../data/messages";
import { DOCTOR_NAME, patients } from "../data/patients";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";

// Reads the whole exchange in order, so a patient who cannot read the screen
// can still hear whether their doctor has answered.
function buildThreadSpeech(thread) {
  if (!thread.length) return "You have not sent any messages yet.";
  return thread
    .map((conversation) => {
      const spoken = conversation.turns
        .map((turn) =>
          turn.from === "doctor"
            ? `${DOCTOR_NAME} said: ${turn.text}`
            : `You said: ${turn.text}`
        )
        .join(". ");
      const waiting = lastTurn(conversation).from === "patient";
      return waiting ? `${spoken}. No reply yet.` : spoken;
    })
    .join(" ");
}

export default function Help() {
  const { user } = useContext(RoleContext);
  const { scale } = useContext(AccessibilityContext);
  const wide = useWide();
  const patient = patients.find((p) => p.id === user) || patients[0];

  const [custom, setCustom] = useState("");
  const [sent, setSent] = useState("");
  const [thread, setThread] = useState([]);

  const refresh = useCallback(() => {
    getConversationsFor(patient.id).then(setThread);
  }, [patient.id]);

  useEffect(() => {
    refresh();
    // The doctor replies from the other portal, so check back periodically.
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function send(text, urgent) {
    if (!text.trim()) return;
    const ok = await startConversation({
      patientId: patient.id,
      patientName: patient.name,
      text,
      urgent,
    });
    setSent(ok ? "Sent to your care team" : "Could not send — please try again");
    setCustom("");
    refresh();
  }

  // A follow-up inside an existing thread, rather than a new conversation.
  async function reply(conversationId, text) {
    await addTurn(conversationId, "patient", text);
    refresh();
  }

  const urgent = QUICK_MESSAGES.filter((m) => m.urgent);
  const routine = QUICK_MESSAGES.filter((m) => !m.urgent);
  const awaiting = thread.filter((c) => lastTurn(c).from === "patient").length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={page(undefined, wide ? 28 : 20)}
    >
      {/* Masthead */}
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 38 * scale,
              lineHeight: 44 * scale,
              fontWeight: "800",
              letterSpacing: -0.5,
              color: T.ink,
            }}
          >
            Get help
          </Text>
          <Text
            style={{
              fontSize: 18 * scale,
              lineHeight: 26 * scale,
              color: T.muted,
              marginTop: 6,
              maxWidth: 520,
            }}
          >
            Tap a message to send it to your care team. They usually reply the same
            day.
          </Text>
        </View>
        <SpeakButton
          text={`Get help. Tap a message to send it to your care team. ${buildThreadSpeech(
            thread
          )}`}
        />
      </View>

      {/* Emergency services sit above everything, and are never a button the
          app can press on someone's behalf. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: T.badBg,
          borderWidth: 1,
          borderColor: T.badLine,
          borderRadius: 14,
          padding: 14,
          marginTop: 18,
        }}
      >
        <Ionicons name="call" size={22} color={T.bad} />
        <Text
          style={{
            marginLeft: 10,
            flex: 1,
            fontSize: 17 * scale,
            lineHeight: 24 * scale,
            fontWeight: "600",
            color: T.bad,
          }}
        >
          In a life-threatening emergency, call 911.
        </Text>
      </View>

      {sent ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: T.goodBg,
            borderRadius: 14,
            padding: 14,
            marginTop: 12,
          }}
        >
          <Ionicons name="checkmark-circle" size={22} color={T.good} />
          <Text
            style={{
              marginLeft: 10,
              fontSize: 17 * scale,
              fontWeight: "700",
              color: T.good,
            }}
          >
            {sent}
          </Text>
        </View>
      ) : null}

      <View
        style={{ height: 1, backgroundColor: T.hair, marginTop: 22, marginBottom: 22 }}
      />

      <View style={columns(wide, 28)}>
        {/* ---------------- Send something ---------------- */}
        <View style={column(wide)}>
          <Text style={sectionLabel(scale)}>Urgent</Text>
          {urgent.map((message) => (
            <QuickButton
              key={message.id}
              scale={scale}
              icon="alert-circle"
              label={message.text}
              tone="urgent"
              onPress={() => send(message.text, true)}
            />
          ))}

          <Text style={{ ...sectionLabel(scale), marginTop: 20 }}>
            Something else
          </Text>
          {routine.map((message) => (
            <QuickButton
              key={message.id}
              scale={scale}
              icon="chatbubble-ellipses"
              label={message.text}
              tone="calm"
              onPress={() => send(message.text, false)}
            />
          ))}

          <Text style={{ ...sectionLabel(scale), marginTop: 20 }}>
            Write your own
          </Text>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            placeholder="Type a message for your care team"
            placeholderTextColor={T.faint}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Your message"
            style={{
              minHeight: 110,
              padding: 14,
              fontSize: 18 * scale,
              lineHeight: 25 * scale,
              color: T.ink,
              backgroundColor: T.surface,
              borderWidth: 2,
              borderColor: T.line,
              borderRadius: 16,
            }}
          />
          <Pressable
            onPress={() => send(custom, false)}
            disabled={!custom.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={{
              minHeight: 60,
              marginTop: 10,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              backgroundColor: custom.trim() ? T.ink : T.raised,
            }}
          >
            <Text
              style={{
                fontSize: 18 * scale,
                fontWeight: "700",
                color: custom.trim() ? "#ffffff" : T.faint,
              }}
            >
              Send message
            </Text>
          </Pressable>
        </View>

        {/* ---------------- Conversation ---------------- */}
        <View style={column(wide)}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              marginTop: wide ? 0 : 28,
            }}
          >
            <Text style={sectionLabel(scale)}>Your messages</Text>
            {awaiting ? (
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 13 * scale,
                  fontWeight: "700",
                  color: T.faint,
                }}
              >
                · {awaiting} awaiting a reply
              </Text>
            ) : null}
          </View>

          {thread.length === 0 ? (
            <View
              style={{
                backgroundColor: T.surface,
                borderWidth: 1,
                borderColor: T.line,
                borderRadius: 20,
                padding: 28,
                alignItems: "center",
              }}
            >
              <Ionicons name="mail-outline" size={32} color={T.faint} />
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 17 * scale,
                  lineHeight: 25 * scale,
                  color: T.muted,
                  textAlign: "center",
                }}
              >
                Nothing sent yet. Anything you send appears here with the reply.
              </Text>
            </View>
          ) : null}

          {thread.map((conversation) => (
            <Thread
              key={conversation.id}
              conversation={conversation}
              scale={scale}
              onReply={(text) => reply(conversation.id, text)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// Urgent options are tinted and icon-led so they read as different in kind,
// not merely a different colour of the same thing.
function QuickButton({ icon, label, tone, onPress, scale }) {
  const isUrgent = tone === "urgent";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isUrgent ? `Send urgent message: ${label}` : `Send message: ${label}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 76,
        paddingHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: isUrgent ? T.badBg : T.surface,
        borderWidth: isUrgent ? 2 : 1,
        borderColor: isUrgent ? T.badLine : T.line,
      }}
    >
      <Ionicons name={icon} size={26} color={isUrgent ? T.bad : T.muted} />
      <Text
        style={{
          marginLeft: 12,
          flex: 1,
          fontSize: 18 * scale,
          lineHeight: 25 * scale,
          fontWeight: isUrgent ? "700" : "600",
          color: isUrgent ? T.bad : T.ink,
        }}
      >
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={isUrgent ? T.bad : T.faint}
      />
    </Pressable>
  );
}

// A whole conversation: every turn in order, plus a box to add another. Turns
// are indented differently by side so the back-and-forth is readable at a
// glance without relying on colour alone.
function Thread({ conversation, scale, onReply }) {
  const [draft, setDraft] = useState("");
  const waiting = lastTurn(conversation).from === "patient";

  async function send() {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    await onReply(text);
  }

  return (
    <View
      style={{
        backgroundColor: T.surface,
        borderWidth: 1,
        borderColor: T.line,
        borderRadius: 20,
        padding: 18,
        marginBottom: 12,
      }}
    >
      {conversation.urgent ? (
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: T.badBg,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 11 * scale, fontWeight: "800", color: T.bad }}>
            URGENT
          </Text>
        </View>
      ) : null}

      {conversation.turns.map((turn, i) => {
        const fromDoctor = turn.from === "doctor";
        return (
          <View
            key={`${turn.sentAt}-${i}`}
            style={{
              marginTop: i === 0 ? 0 : 14,
              paddingTop: i === 0 ? 0 : 14,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: T.hair,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}
            >
              <Ionicons
                name={fromDoctor ? "medkit" : "person"}
                size={17}
                color={fromDoctor ? T.good : T.faint}
              />
              <Text
                style={{
                  marginLeft: 7,
                  fontSize: 13 * scale,
                  fontWeight: "700",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: fromDoctor ? T.good : T.faint,
                }}
              >
                {fromDoctor ? DOCTOR_NAME : "You"} · {turn.timeLabel}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 18 * scale,
                lineHeight: 26 * scale,
                color: T.ink,
                paddingLeft: fromDoctor ? 24 : 0,
              }}
            >
              {turn.text}
            </Text>
          </View>
        );
      })}

      <View
        style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.hair }}
      >
        {waiting ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}
          >
            <Ionicons name="time-outline" size={17} color={T.faint} />
            <Text style={{ marginLeft: 7, fontSize: 15 * scale, color: T.faint }}>
              Waiting for a reply
            </Text>
          </View>
        ) : null}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add to this conversation"
          placeholderTextColor={T.faint}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Add to this conversation"
          style={{
            minHeight: 64,
            padding: 12,
            fontSize: 17 * scale,
            lineHeight: 24 * scale,
            color: T.ink,
            backgroundColor: T.bg,
            borderWidth: 1,
            borderColor: T.line,
            borderRadius: 12,
          }}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send follow-up message"
          style={{
            alignSelf: "flex-start",
            minHeight: 52,
            marginTop: 10,
            paddingHorizontal: 20,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: draft.trim() ? T.ink : T.raised,
          }}
        >
          <Text
            style={{
              fontSize: 16 * scale,
              fontWeight: "700",
              color: draft.trim() ? "#ffffff" : T.faint,
            }}
          >
            Send
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
