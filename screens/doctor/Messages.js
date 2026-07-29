import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { READING_WIDTH, page } from "../../components/layout";
import { getMessages, markRead, replyToMessage } from "../../data/messages";

// The doctor's inbox. Urgent messages sort to the top (see data/messages.js),
// because the ordering is the triage.
export default function Messages() {
  const [messages, setMessages] = useState([]);

  const refresh = useCallback(() => {
    getMessages().then(setMessages);
  }, []);

  useEffect(() => {
    refresh();
    // Patients send from the other portal, so poll rather than assume the
    // list is static while this tab is open.
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const unread = messages.filter((m) => !m.read).length;
  const urgent = messages.filter((m) => m.urgent && !m.read).length;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={page(READING_WIDTH)}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-3xl font-bold text-gray-900">Messages</Text>
        <Pressable onPress={refresh} className="rounded-lg bg-gray-200 px-3 py-2">
          <Text className="text-sm font-medium text-gray-700">Refresh</Text>
        </Pressable>
      </View>
      <Text className="text-sm text-gray-500 mb-5">
        {messages.length} total • {unread} unread • {urgent} urgent
      </Text>

      {messages.length === 0 ? (
        <View className="bg-white rounded-xl border border-gray-200 p-6 items-center">
          <Ionicons name="mail-open-outline" size={32} color="#9ca3af" />
          <Text className="text-sm text-gray-500 mt-2 text-center">
            No messages yet. Patient messages arrive here, urgent ones first.
          </Text>
        </View>
      ) : null}

      {messages.map((message) => (
        <View
          key={message.id}
          className={`bg-white rounded-xl border p-4 mb-3 ${
            message.urgent && !message.read
              ? "border-red-400 border-2"
              : "border-gray-200"
          }`}
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center flex-1">
              {message.urgent ? (
                <Ionicons name="alert-circle" size={18} color="#991b1b" />
              ) : (
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6b7280" />
              )}
              <Text className="text-base font-semibold text-gray-900 ml-2">
                {message.patientName}
              </Text>
              {message.urgent ? (
                <View className="ml-2 rounded-full bg-red-100 px-2 py-0.5">
                  <Text className="text-xs font-semibold" style={{ color: "#991b1b" }}>
                    URGENT
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="text-xs text-gray-500">{message.timeLabel}</Text>
          </View>

          <Text className="text-sm text-gray-800">{message.text}</Text>

          {message.reply ? (
            <View className="mt-3 border-l-2 border-gray-300 pl-3">
              <Text className="text-xs font-semibold text-gray-500 mb-0.5">
                Your reply • {message.reply.timeLabel}
              </Text>
              <Text className="text-sm text-gray-700">{message.reply.text}</Text>
            </View>
          ) : (
            <ReplyBox messageId={message.id} onDone={refresh} />
          )}

          {!message.read ? (
            <Pressable
              onPress={() => markRead(message.id).then(refresh)}
              className="self-start mt-3 rounded-lg bg-gray-100 border border-gray-200 px-3 py-1.5"
            >
              <Text className="text-xs font-medium text-gray-700">
                Mark as handled
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
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
    <View className="mt-3">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write a reply…"
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        accessibilityLabel="Reply to this message"
        className="border border-gray-300 rounded-lg p-2 text-sm text-gray-900 bg-white"
        style={{ minHeight: 56 }}
      />
      <Pressable
        onPress={send}
        disabled={!text.trim() || sending}
        className={`self-start mt-2 rounded-lg px-4 py-2 ${
          text.trim() ? "bg-gray-900" : "bg-gray-300"
        }`}
      >
        <Text className="text-sm font-medium text-white">
          {sending ? "Sending…" : "Send reply"}
        </Text>
      </Pressable>
    </View>
  );
}
