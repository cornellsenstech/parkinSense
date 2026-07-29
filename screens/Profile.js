import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useContext, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { defaultProfile, loadProfile, saveProfile } from "../data/profile";
import { RoleContext } from "../context/RoleContext";

export default function Profile() {
  const { role, user, setRole } = useContext(RoleContext);
  const isDoctor = role === "doctor";

  const [profile, setProfile] = useState(() => defaultProfile(user));
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (isDoctor) return;
    let active = true;
    loadProfile(user).then((saved) => {
      if (active) setProfile(saved);
    });
    return () => {
      active = false;
    };
  }, [user, isDoctor]);

  function update(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setStatus("");
  }

  async function pickPhoto() {
    // Ask only when the patient actually taps — no prompt on screen load.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus("Photo access was declined");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6, // keep the stored copy small
    });
    if (!result.canceled) {
      update("photo", result.assets[0].uri);
    }
  }

  async function handleSave() {
    const ok = await saveProfile(user, profile);
    setStatus(ok ? "Profile saved" : "Could not save — try again");
  }

  // The doctor portal reuses this tab, but has no patient record to edit.
  if (isDoctor) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Ionicons name="person-circle" size={96} color="#111827" />
        <Text className="text-2xl font-bold text-gray-900 mt-3">Dr. Bunsen</Text>
        <Text className="text-base text-gray-500 mb-8">Signed in as Doctor</Text>
        <Pressable
          onPress={() => setRole(null)}
          className="bg-gray-200 rounded-xl px-6 py-3"
        >
          <Text className="text-base font-semibold text-gray-800">Switch portal</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
    >
      <Text className="text-5xl font-black text-gray-900 mb-6">Profile</Text>

      {/* Photo */}
      <View className="items-center mb-6">
        <Pressable
          onPress={pickPhoto}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
        >
          {profile.photo ? (
            <Image
              source={{ uri: profile.photo }}
              style={{ width: 140, height: 140, borderRadius: 70 }}
            />
          ) : (
            <View
              className="items-center justify-center bg-gray-200 border-2 border-gray-300"
              style={{ width: 140, height: 140, borderRadius: 70 }}
            >
              <Ionicons name="camera" size={44} color="#4b5563" />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={pickPhoto}
          className="mt-3 rounded-xl bg-gray-200 px-5 items-center justify-center"
          style={{ minHeight: 48 }}
        >
          <Text className="text-base font-semibold text-gray-800">
            {profile.photo ? "Change photo" : "Add photo"}
          </Text>
        </Pressable>

        <Text className="text-2xl font-bold text-gray-900 mt-4">{profile.name}</Text>
      </View>

      {/* Details */}
      <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
        <Field
          label="Age"
          value={profile.age}
          onChange={(v) => update("age", v)}
          keyboardType="number-pad"
          placeholder="42"
        />
        <Field
          label="Weight"
          value={profile.weight}
          onChange={(v) => update("weight", v)}
          placeholder="165 lbs"
        />
        <Field
          label="Height"
          value={profile.height}
          onChange={(v) => update("height", v)}
          placeholder="5 ft 8 in"
        />
        <Field
          label="Email address"
          value={profile.email}
          onChange={(v) => update("email", v)}
          keyboardType="email-address"
          placeholder="you@example.com"
          last
        />

        <Text className="text-sm text-gray-500 mt-1 mb-4">
          Weight and age affect how your medication is absorbed, so your care team
          uses them alongside your readings.
        </Text>

        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          className="bg-black rounded-2xl items-center justify-center"
          style={{ minHeight: 56 }}
        >
          <Text className="text-white text-lg font-semibold">Save profile</Text>
        </Pressable>

        {status ? (
          <Text className="text-base text-gray-600 mt-3 text-center">{status}</Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => setRole(null)}
        className="bg-gray-200 rounded-2xl items-center justify-center"
        style={{ minHeight: 56 }}
      >
        <Text className="text-lg font-semibold text-gray-800">Switch portal</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, last }) {
  return (
    <View className={last ? "" : "mb-5"}>
      <Text className="text-lg font-semibold text-gray-900 mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        autoCapitalize="none"
        accessibilityLabel={label}
        className="border-2 border-gray-300 rounded-2xl px-4 text-lg text-gray-900 bg-white"
        style={{ minHeight: 56 }}
      />
    </View>
  );
}
