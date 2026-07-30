import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { page } from "../../components/layout";
import { T, sectionLabel } from "../../components/theme";
import { getMessages, markRead, replyToMessage } from "../../data/messages";

// The doctor's inbox. Urgent messages sort to the top (see data/messages.js),
// because the ordering is the triage.
export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState("open");

  const refresh = useCallback(() => {
    getMessages().then(setMessages);
  }, []);

  useEffect(() => {
    refresh();
    // Patients send from the other portal, so poll rather than assume the list
    // is static while this tab is open.
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const open = messages.filter((m) => !m.read);
  const urgent = open.filter((m) => m.urgent);
  const shown = filter === "open" ? open : messages;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      contentContainerStyle={page(720)}
    >
      <Text
        style={{
          fontSize: 30 * 1,
          lineHeight: 36,
          fontWeight: "800",
          letterSpacing: -0.4,
          color: T.ink,
        }}
      >
        Messages
      </Text>

      {/* Counts as a strip, so the triage picture reads before any one message */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: T.surface,
          borderWidth: 1,
          borderColor: T.line,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Count value={urgent.length} label="Urgent" tone={T.bad} />
        <Count value={open.length} label="Open" divider />
        <Count value={messages.length} label="Total" divider />
      </View>

      {/* Filter + manual refresh */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 18,
          marginBottom: 18,
        }}
      >
        <Tab
          label={`Open (${open.length})`}
          active={filter === "open"}
          onPress={() => setFilter("open")}
        />
        <Tab
          label="All"
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={refresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh messages"
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 10,
            backgroundColor: T.raised,
          }}
        >
          <Ionicons name="refresh" size={16} color={T.muted} />
          <Text
            style={{ marginLeft: 6, fontSize: 13, fontWeight: "600", color: T.muted }}
          >
            Refresh
          </Text>
        </Pressable>
      </View>

      {shown.length === 0 ? (
        <View
          style={{
            backgroundColor: T.surface,
            borderWidth: 1,
            borderColor: T.line,
            borderRadius: 20,
            padding: 32,
            alignItems: "center",
          }}
        >
          <Ionicons name="checkmark-done-outline" size={32} color={T.faint} />
          <Text
            style={{
              marginTop: 12,
              fontSize: 15,
              lineHeight: 22,
              color: T.muted,
              textAlign: "center",
            }}
          >
            {filter === "open"
              ? "Nothing open. Patient messages arrive here, urgent ones first."
              : "No messages yet."}
          </Text>
        </View>
      ) : null}

      {shown.map((message) => (
        <MessageCard key={message.id} message={message} onDone={refresh} />
      ))}
    </ScrollView>
  );
}

function Count({ value, label, tone, divider }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 14,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: T.hair,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color: tone || T.ink }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        marginRight: 8,
        borderRadius: 10,
        backgroundColor: active ? T.ink : "transparent",
        borderWidth: active ? 0 : 1,
        borderColor: T.line,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: active ? "#ffffff" : T.muted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MessageCard({ message, onDone }) {
  const unhandledUrgent = message.urgent && !message.read;

  return (
    <View
      style={{
        backgroundColor: T.surface,
        borderRadius: 16,
        borderWidth: unhandledUrgent ? 2 : 1,
        borderColor: unhandledUrgent ? T.badLine : T.line,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      {/* A severity strip rather than a coloured card — the state reads at a
          glance without tinting the text behind it. */}
      {unhandledUrgent ? (
        <View style={{ height: 4, backgroundColor: T.bad }} />
      ) : null}

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: T.ink, flex: 1 }}>
            {message.patientName}
          </Text>
          {message.urgent ? (
            <View
              style={{
                backgroundColor: T.badBg,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: T.bad }}>
                URGENT
              </Text>
            </View>
          ) : null}
          <Text style={{ fontSize: 12, color: T.faint }}>{message.timeLabel}</Text>
        </View>

        <Text
          style={{ fontSize: 15, lineHeight: 22, color: T.ink, marginTop: 10 }}
        >
          {message.text}
        </Text>

        {message.reply ? (
          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: T.hair,
            }}
          >
            <Text style={sectionLabel(1)}>You replied · {message.reply.timeLabel}</Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: T.muted }}>
              {message.reply.text}
            </Text>
          </View>
        ) : (
          <ReplyBox messageId={message.id} onDone={onDone} />
        )}

        {!message.read ? (
          <Pressable
            onPress={() => markRead(message.id).then(onDone)}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${message.patientName}'s message handled`}
            style={{
              alignSelf: "flex-start",
              marginTop: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: T.raised,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: T.muted }}>
              Mark handled without replying
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ReplyBox({ messageId, onDone }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!text.trim() || sending) return; // guard against a double tap
    setSending(true);
    await replyToMessage(messageId, text);
    setText("");
    setSending(false);
    onDone();
  }

  return (
    <View
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: T.hair,
      }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write a reply…"
        placeholderTextColor={T.faint}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Reply to this message"
        style={{
          minHeight: 64,
          padding: 12,
          fontSize: 14,
          lineHeight: 20,
          color: T.ink,
          backgroundColor: T.bg,
          borderWidth: 1,
          borderColor: T.line,
          borderRadius: 12,
        }}
      />
      <Pressable
        onPress={send}
        disabled={!text.trim() || sending}
        accessibilityRole="button"
        accessibilityLabel="Send reply"
        style={{
          alignSelf: "flex-start",
          marginTop: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: text.trim() ? T.ink : T.raised,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: text.trim() ? "#ffffff" : T.faint,
          }}
        >
          {sending ? "Sending…" : "Send reply"}
        </Text>
      </Pressable>
    </View>
  );
}
