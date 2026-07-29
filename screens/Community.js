import { Ionicons } from "@expo/vector-icons";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import EventMap from "../components/EventMap";
import SpeakButton from "../components/SpeakButton";
import { EVENTS, KIND_LABELS } from "../data/events";
import { fetchNearbyPlaces, geocode, milesBetween } from "../data/places";
import { loadSaved, toggleSaved } from "../data/savedEvents";
import { timingFor } from "../data/timing";
import { RoleContext } from "../context/RoleContext";

const HOME = { lat: 42.4396, lon: -76.4969, label: "Ithaca, NY" };

export default function Community() {
  const { user } = useContext(RoleContext);

  const [center, setCenter] = useState(HOME);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [stepFreeOnly, setStepFreeOnly] = useState(false);

  useEffect(() => {
    loadSaved(user).then(setSaved);
  }, [user]);

  // Pull real nearby places whenever the map centre moves.
  const loadPlaces = useCallback(async (point) => {
    setLoading(true);
    setStatus("");
    const found = await fetchNearbyPlaces(point.lat, point.lon);
    setPlaces(found);
    setLoading(false);
    // Say so when the live lookup gives nothing, rather than looking empty.
    if (!found.length) {
      setStatus("Could not reach the map service — showing programmes only.");
    }
  }, []);

  useEffect(() => {
    loadPlaces(center);
  }, [center, loadPlaces]);

  async function runLocationSearch() {
    if (!query.trim()) return;
    setLoading(true);
    const place = await geocode(query);
    setLoading(false);
    if (place) {
      setCenter(place);
      setQuery("");
    } else {
      setStatus(`Could not find "${query}".`);
    }
  }

  async function handleSave(id) {
    setSaved(await toggleSaved(user, id));
  }

  // Curated programmes plus live places, with distance and timing worked out.
  const items = useMemo(() => {
    const all = [...EVENTS, ...places].map((item) => ({
      ...item,
      miles: milesBetween(center, item),
      timing: timingFor(user, item.startHour),
      isSaved: saved.includes(item.id),
    }));

    const text = search.trim().toLowerCase();
    return all
      .filter((item) => (showSavedOnly ? item.isSaved : true))
      .filter((item) => (stepFreeOnly ? item.stepFree : true))
      .filter((item) =>
        text
          ? `${item.name} ${item.venue} ${KIND_LABELS[item.kind] || ""}`
              .toLowerCase()
              .includes(text)
          : true
      )
      .sort((a, b) => a.miles - b.miles);
  }, [places, center, saved, showSavedOnly, stepFreeOnly, search, user]);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-5xl font-black text-gray-900">Community</Text>
          <Text className="text-lg text-gray-600 mb-4">
            Classes, groups and care near {center.label}
          </Text>
        </View>
        <SpeakButton
          text={`Community. ${items.length} results near ${center.label}.`}
        />
      </View>

      {/* Where to look */}
      <View className="flex-row mb-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runLocationSearch}
          placeholder="Town or postcode"
          placeholderTextColor="#9ca3af"
          accessibilityLabel="Search a place"
          className="flex-1 border-2 border-gray-300 rounded-2xl px-4 text-lg text-gray-900 bg-white mr-2"
          style={{ minHeight: 56 }}
        />
        <Pressable
          onPress={runLocationSearch}
          accessibilityRole="button"
          accessibilityLabel="Search this place"
          className="bg-black rounded-2xl px-5 items-center justify-center"
          style={{ minHeight: 56 }}
        >
          <Ionicons name="search" size={24} color="#ffffff" />
        </Pressable>
      </View>

      {/* What to look for */}
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search events — boxing, dance, support…"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Search events"
        className="border-2 border-gray-300 rounded-2xl px-4 text-lg text-gray-900 bg-white mb-3"
        style={{ minHeight: 56 }}
      />

      <View className="flex-row mb-4">
        <Toggle
          label="All"
          active={!showSavedOnly}
          onPress={() => setShowSavedOnly(false)}
        />
        <Toggle
          label={`Saved (${saved.length})`}
          active={showSavedOnly}
          onPress={() => setShowSavedOnly(true)}
        />
        <Toggle
          label="Step-free"
          active={stepFreeOnly}
          onPress={() => setStepFreeOnly(!stepFreeOnly)}
        />
      </View>

      <View className="mb-4">
        <EventMap center={center} items={items} />
      </View>

      {loading ? (
        <View className="flex-row items-center mb-3">
          <ActivityIndicator />
          <Text className="text-base text-gray-600 ml-2">Looking nearby…</Text>
        </View>
      ) : null}

      {status ? (
        <Text className="text-base text-gray-600 mb-3">{status}</Text>
      ) : null}

      <Text className="text-base text-gray-600 mb-3">
        {items.length} result{items.length === 1 ? "" : "s"}
      </Text>

      {items.length === 0 ? (
        <View className="bg-white rounded-2xl border border-gray-200 p-6 items-center">
          <Ionicons name="search-outline" size={30} color="#9ca3af" />
          <Text className="text-base text-gray-600 mt-2 text-center">
            {showSavedOnly
              ? "Nothing saved yet. Tap the star on an event to keep it here."
              : "No matches. Try a different search."}
          </Text>
        </View>
      ) : null}

      {items.map((item) => (
        <EventCard key={item.id} item={item} onSave={() => handleSave(item.id)} />
      ))}

      <Text className="text-sm text-gray-500 mt-4">
        Programme times are curated. Nearby places come from OpenStreetMap.
      </Text>
    </ScrollView>
  );
}

function Toggle({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full px-4 mr-2 items-center justify-center ${
        active ? "bg-black" : "bg-white border-2 border-gray-300"
      }`}
      style={{ minHeight: 48 }}
    >
      <Text
        className={`text-base font-semibold ${active ? "text-white" : "text-gray-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EventCard({ item, onSave }) {
  const timingColor =
    item.timing?.fit === "good"
      ? "#166534"
      : item.timing?.fit === "poor"
      ? "#9a3412"
      : "#6b7280";

  const speech = [
    item.name,
    item.venue,
    item.day ? `${item.day} at ${item.time}` : "",
    item.timing ? item.timing.label : "",
    `${item.miles.toFixed(1)} miles away`,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-xl font-bold text-gray-900">{item.name}</Text>
          <Text className="text-base text-gray-600 mt-0.5">
            {item.venue}
            {item.address ? ` • ${item.address}` : ""}
          </Text>
        </View>

        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityState={{ selected: item.isSaved }}
          accessibilityLabel={item.isSaved ? `Remove ${item.name}` : `Save ${item.name}`}
          className="items-center justify-center"
          style={{ width: 48, height: 48 }}
        >
          <Ionicons
            name={item.isSaved ? "star" : "star-outline"}
            size={28}
            color={item.isSaved ? "#f59e0b" : "#6b7280"}
          />
        </Pressable>
      </View>

      {item.day ? (
        <Text className="text-lg font-semibold text-gray-900 mt-2">
          {item.day} at {item.time}
        </Text>
      ) : null}

      {/* The bit a generic events list can't do */}
      {item.timing ? (
        <View className="flex-row items-start mt-2">
          <Ionicons
            name={item.timing.fit === "good" ? "checkmark-circle" : "alert-circle"}
            size={20}
            color={timingColor}
          />
          <View className="ml-2 flex-1">
            <Text className="text-base font-semibold" style={{ color: timingColor }}>
              {item.timing.label}
            </Text>
            <Text className="text-sm text-gray-500">{item.timing.detail}</Text>
          </View>
        </View>
      ) : null}

      {item.note ? (
        <Text className="text-base text-gray-700 mt-2">{item.note}</Text>
      ) : null}

      <View className="flex-row flex-wrap items-center mt-3">
        <Tag icon="walk" label={`${item.miles.toFixed(1)} mi`} />
        {item.stepFree ? <Tag icon="accessibility" label="Step-free" /> : null}
        {item.seated ? <Tag icon="body" label="Seated option" /> : null}
        {item.caregiverWelcome ? <Tag icon="people" label="Carers welcome" /> : null}
        {item.virtual ? <Tag icon="videocam" label="Online option" /> : null}
        {item.live ? <Tag icon="globe" label="From OpenStreetMap" /> : null}
      </View>

      <View className="mt-3">
        <SpeakButton text={speech} label={`Read ${item.name} aloud`} />
      </View>
    </View>
  );
}

function Tag({ icon, label }) {
  return (
    <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-1.5 mr-2 mb-2">
      <Ionicons name={icon} size={16} color="#374151" />
      <Text className="text-sm text-gray-700 ml-1.5">{label}</Text>
    </View>
  );
}
