import { Ionicons } from "@expo/vector-icons";
import { useContext, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import credentials from "../data/credentials.json";
import { RoleContext } from "../context/RoleContext";

// Simple demo login for the patient portal. Credentials live in
// data/credentials.json (plaintext — demo only, not real auth).
export default function PatientLogin() {
  const { setUser, setRole } = useContext(RoleContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const key = username.trim().toLowerCase();
    if (credentials[key] && credentials[key] === password) {
      setError("");
      setUser(key);
    } else {
      setError("Incorrect username or password.");
    }
  }

  return (
    <View className="flex-1 bg-gray-50 justify-center p-6">
      <View className="w-full max-w-md self-center">
        <Pressable
          onPress={() => setRole(null)}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="flex-row items-center self-start mb-6"
          style={{ minHeight: 48 }}
        >
          <Ionicons name="chevron-back" size={22} color="#374151" />
          <Text className="text-lg font-medium text-gray-700 ml-1">Back</Text>
        </Pressable>

        <Text className="text-4xl font-black text-gray-900 mb-1">Patient sign in</Text>
        <Text className="text-lg text-gray-600 mb-8">
          Enter your username and password
        </Text>

        <Text className="text-lg font-semibold text-gray-900 mb-2">Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. robert"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Username"
          className="bg-white border-2 border-gray-300 rounded-2xl px-4 text-lg text-gray-900 mb-5"
          style={{ minHeight: 56 }}
        />

        <Text className="text-lg font-semibold text-gray-900 mb-2">Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          autoCapitalize="none"
          accessibilityLabel="Password"
          onSubmitEditing={submit}
          className="bg-white border-2 border-gray-300 rounded-2xl px-4 text-lg text-gray-900 mb-4"
          style={{ minHeight: 56 }}
        />

        {error ? (
          <Text className="text-base text-red-600 mb-4">{error}</Text>
        ) : null}

        <Pressable
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          className="bg-black rounded-2xl items-center justify-center mt-2"
          style={{ minHeight: 56 }}
        >
          <Text className="text-white text-lg font-semibold">Sign in</Text>
        </Pressable>

        <Text className="text-sm text-gray-500 mt-6 text-center">
          Demo logins: robert, margaret, frank, helen — password: parkinsense
        </Text>
      </View>
    </View>
  );
}
