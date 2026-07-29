import { Ionicons } from "@expo/vector-icons";
import { useContext, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Card from "../components/Card";
import { QUICK_MESSAGES, sendMessage } from "../data/messages";
import { patients } from "../data/patients";
import { RoleContext } from "../context/RoleContext";

// The patient's way to reach their care team. Everything here is sized for a
// bad tremor episode — the worst possible moment for fine motor control — so
// the common messages are one large tap, with typing as the fallback.
export default function Help() {
  const { user } = useContext(RoleContext);
  const patient = patients.find((p) => p.id === user) || patients[0];

  const [custom, setCustom] = useState("");
  const [sent, setSent] = useState("");

  async function send(text, urgent) {
    if (!text.trim()) return;
    const ok = await sendMessage({
      patientId: patient.id,
      patientName: patient.name,
      text: text.trim(),
      urgent,
    });
    setSent(ok ? "Sent to your care team" : "Could not send — try again");
    setCustom("");
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
    >
      <Text className="text-5xl font-black text-gray-900 mb-1">Get help</Text>
      <Text className="text-lg text-gray-600 mb-6">
        Tap a message to send it to your care team
      </Text>

      {sent ? (
        <View className="flex-row items-center bg-green-100 border border-green-300 rounded-2xl p-4 mb-5">
          <Ionicons name="checkmark-circle" size={26} color="#166534" />
          <Text className="text-lg font-semibold ml-2" style={{ color: "#166534" }}>
            {sent}
          </Text>
        </View>
      ) : null}

      {/* Emergency first and largest — it is the reason this screen exists. */}
      {QUICK_MESSAGES.filter((m) => m.urgent).map((message) => (
        <Pressable
          key={message.id}
          onPress={() => send(message.text, true)}
          accessibilityRole="button"
          accessibilityLabel={`Send urgent message: ${message.text}`}
          className="bg-red-600 rounded-3xl p-6 mb-4 flex-row items-center"
          style={{ minHeight: 96 }}
        >
          <Ionicons name="alert-circle" size={40} color="#ffffff" />
          <Text className="text-white text-2xl font-bold ml-3 flex-1">
            {message.text}
          </Text>
        </Pressable>
      ))}

      {QUICK_MESSAGES.filter((m) => !m.urgent).map((message) => (
        <Pressable
          key={message.id}
          onPress={() => send(message.text, false)}
          accessibilityRole="button"
          accessibilityLabel={`Send message: ${message.text}`}
          className="bg-white border-2 border-gray-300 rounded-3xl p-5 mb-4 flex-row items-center"
          style={{ minHeight: 80 }}
        >
          <Ionicons name="chatbubble-ellipses" size={30} color="#111827" />
          <Text className="text-gray-900 text-xl font-semibold ml-3 flex-1">
            {message.text}
          </Text>
        </Pressable>
      ))}

      <Card title="Say something else">
        <TextInput
          value={custom}
          onChangeText={setCustom}
          placeholder="Type a message for your care team"
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          accessibilityLabel="Your message"
          className="border-2 border-gray-300 rounded-2xl p-4 text-lg text-gray-900 bg-white mb-4"
          style={{ minHeight: 100 }}
        />
        <Pressable
          onPress={() => send(custom, false)}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          className="bg-black rounded-2xl items-center justify-center"
          style={{ minHeight: 56 }}
        >
          <Text className="text-white text-lg font-semibold">Send message</Text>
        </Pressable>
      </Card>

      <Text className="text-base text-gray-600 text-center">
        In a life-threatening emergency, call your local emergency number.
      </Text>
    </ScrollView>
  );
}
