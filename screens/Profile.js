import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Pressable, Text, View } from "react-native";
import { patients } from "../data/patients";
import { RoleContext } from "../context/RoleContext";

export default function Profile() {
  const { role, user, setRole } = useContext(RoleContext);
  const patient = patients.find((p) => p.id === user);
  const name = role === "doctor" ? "Dr. Bunsen" : patient ? patient.name : "Patient";

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <Ionicons name="person-circle" size={120} color="#111827" />
      <Text className="text-3xl font-bold text-gray-900 mt-4">{name}</Text>
      <Text className="text-lg text-gray-600 mb-10">
        Signed in as {role === "doctor" ? "Doctor" : "Patient"}
      </Text>
      <Pressable
        onPress={() => setRole(null)}
        accessibilityRole="button"
        accessibilityLabel="Switch portal"
        className="bg-gray-200 rounded-2xl px-8 items-center justify-center"
        style={{ minHeight: 56 }}
      >
        <Text className="text-lg font-semibold text-gray-800">Switch portal</Text>
      </Pressable>
    </View>
  );
}
