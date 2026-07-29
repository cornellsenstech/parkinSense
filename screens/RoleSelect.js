import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Pressable, Text, View } from "react-native";
import { RoleContext } from "../context/RoleContext";

// Landing screen: pick which portal to enter. On web the choice can also
// be pre-set with ?role=patient or ?role=doctor in the URL (see App.js).
export default function RoleSelect() {
  const { setRole } = useContext(RoleContext);
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <Text className="text-5xl font-black text-gray-900 mb-2">ParkinSense</Text>
      <Text className="text-lg text-gray-600 mb-10">Choose how you want to sign in</Text>

      <View className="w-full max-w-md">
        <Pressable
          onPress={() => setRole("patient")}
          accessibilityRole="button"
          accessibilityLabel="Sign in as a patient"
          className="bg-black rounded-3xl p-6 mb-4 flex-row items-center"
          style={{ minHeight: 96 }}
        >
          <Ionicons name="person-circle" size={44} color="#ffffff" style={{ marginRight: 14 }} />
          <View className="flex-1">
            <Text className="text-white text-2xl font-bold mb-1">I&apos;m a Patient</Text>
            <Text className="text-gray-300 text-base">
              Track your levels, symptoms, and device
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setRole("doctor")}
          accessibilityRole="button"
          accessibilityLabel="Sign in as a doctor"
          className="bg-white border-2 border-gray-300 rounded-3xl p-6 flex-row items-center"
          style={{ minHeight: 96 }}
        >
          <Ionicons name="medkit" size={44} color="#111827" style={{ marginRight: 14 }} />
          <View className="flex-1">
            <Text className="text-gray-900 text-2xl font-bold mb-1">I&apos;m a Doctor</Text>
            <Text className="text-gray-600 text-base">
              Monitor your patients&apos; readings and trends
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
