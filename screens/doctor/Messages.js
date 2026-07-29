import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getMessages, markRead } from "../../data/messages";

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
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
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

          {!message.read ? (
            <Pressable
              onPress={() => markRead(message.id).then(refresh)}
              className="self-start mt-3 rounded-lg bg-gray-100 border border-gray-200 px-3 py-1.5"
            >
              <Text className="text-xs font-medium text-gray-700">
                Mark as handled
              </Text>
            </Pressable>
          ) : (
            <Text className="text-xs text-gray-400 mt-2">Handled</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
