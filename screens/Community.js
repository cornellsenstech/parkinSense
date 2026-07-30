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
import { page, useWide } from "../components/layout";
import { T } from "../components/theme";
import SpeakButton from "../components/SpeakButton";
import { EVENTS, LOCAL_RADIUS_MILES, ONLINE_EVENTS } from "../data/events";
import { fetchNearbyPlaces, geocode, milesBetween } from "../data/places";
import { loadSaved, toggleSaved } from "../data/savedEvents";
import { timingFor } from "../data/timing";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";

const HOME = { lat: 42.4396, lon: -76.4969, label: "Ithaca, NY" };

// Shared palette, so this screen cannot drift from Help and Messages.
const C = T;

// Browsing by tapping is easier than typing, which matters when a tremor makes
// a keyboard hard to use.
const CATEGORIES = [
  { id: "all", label: "Show all", icon: "apps" },
  { id: "exercise", label: "Exercise", icon: "fitness" },
  { id: "support", label: "Support", icon: "people" },
  { id: "therapy", label: "Therapy", icon: "medkit" },
  { id: "facility", label: "Care homes", icon: "home" },
];

const PAGE = 5;

export default function Community() {
  const { user } = useContext(RoleContext);
  const { scale } = useContext(AccessibilityContext);

  // On a wide screen the controls sit in a sidebar beside the results. On a
  // phone there is no room, so everything stacks.
  const wide = useWide();

  const [center, setCenter] = useState(HOME);
  const [placeQuery, setPlaceQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [stepFreeOnly, setStepFreeOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    loadSaved(user).then(setSaved);
  }, [user]);

  const loadPlaces = useCallback(async (point) => {
    setLoading(true);
    setStatus("");
    const found = await fetchNearbyPlaces(point.lat, point.lon);
    setPlaces(found);
    setLoading(false);
    if (!found.length) {
      setStatus(
        "We could not load nearby places just now. Classes are still listed below."
      );
    }
  }, []);

  useEffect(() => {
    loadPlaces(center);
  }, [center, loadPlaces]);

  async function findPlace() {
    if (!placeQuery.trim()) return;
    setLoading(true);
    const place = await geocode(placeQuery);
    setLoading(false);
    if (place) {
      setCenter(place);
      setPlaceQuery("");
      setVisible(PAGE);
    } else {
      setStatus(`We could not find "${placeQuery}". Try a town name.`);
    }
  }

  async function handleSave(id) {
    setSaved(await toggleSaved(user, id));
  }

  function reset(setter, value) {
    setter(value);
    setVisible(PAGE); // a new filter should start from the top
  }

  const filtersActive =
    category !== "all" || savedOnly || stepFreeOnly || nameQuery.trim() !== "";

  function clearFilters() {
    setCategory("all");
    setSavedOnly(false);
    setStepFreeOnly(false);
    setNameQuery("");
    setVisible(PAGE);
  }

  // Named so the empty state can explain exactly why nothing matched, rather
  // than leaving the patient staring at a blank list.
  function activeFilterNames() {
    const names = [];
    if (category !== "all") {
      const match = CATEGORIES.find((c) => c.id === category);
      if (match) names.push(match.label.toLowerCase());
    }
    if (savedOnly) names.push("saved only");
    if (stepFreeOnly) names.push("no steps only");
    if (nameQuery.trim()) names.push(`name contains "${nameQuery.trim()}"`);
    return names;
  }

  const items = useMemo(() => {
    // Anything with coordinates gets a distance and is dropped if it is too far
    // from where the patient is looking.
    const nearby = [...EVENTS, ...places]
      .map((item) => ({ ...item, miles: milesBetween(center, item) }))
      .filter((item) => item.live || item.miles <= LOCAL_RADIUS_MILES);

    // Online programmes have no location, so they always apply.
    const online = ONLINE_EVENTS.map((item) => ({ ...item, miles: null }));

    const all = [...nearby, ...online].map((item) => ({
      ...item,
      timing: timingFor(user, item.startHour),
      isSaved: saved.includes(item.id),
    }));

    const text = nameQuery.trim().toLowerCase();
    return (
      all
        .filter((item) => (savedOnly ? item.isSaved : true))
        .filter((item) => (category === "all" ? true : item.kind === category))
        .filter((item) => (stepFreeOnly ? item.stepFree : true))
        .filter((item) =>
          text ? `${item.name} ${item.venue}`.toLowerCase().includes(text) : true
        )
        // Nearest first, with online programmes after anything local.
        .sort((a, b) => {
          if (a.miles === null) return 1;
          if (b.miles === null) return -1;
          return a.miles - b.miles;
        })
    );
  }, [places, center, saved, savedOnly, category, stepFreeOnly, nameQuery, user]);

  // Only things with coordinates can be drawn on the map.
  const mapped = items.filter((item) => item.miles !== null);

  const shown = items.slice(0, visible);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f8fafc" }}
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
              color: C.ink,
            }}
          >
            Community
          </Text>
          <Text
            style={{
              fontSize: 18 * scale,
              lineHeight: 26 * scale,
              color: C.muted,
              marginTop: 6,
              maxWidth: 560,
            }}
          >
            Exercise classes, support groups and care homes near you.
          </Text>
        </View>
        <SpeakButton
          text={`Community. Classes and groups near ${center.label}. ${items.length} found.`}
        />
      </View>

      <View
        style={{ height: 1, backgroundColor: C.hair, marginTop: 20, marginBottom: 24 }}
      />

      <View style={wide ? { flexDirection: "row", alignItems: "flex-start" } : null}>
        {/* ---------------- Sidebar ---------------- */}
        <View
          style={
            wide
              ? {
                  width: 292,
                  marginRight: 28,
                  backgroundColor: C.surface,
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 20,
                  padding: 20,
                }
              : null
          }
        >
          <Group scale={scale} label="Near" first>
            <View style={{ flexDirection: "row" }}>
              <TextInput
                value={placeQuery}
                onChangeText={setPlaceQuery}
                onSubmitEditing={findPlace}
                placeholder={center.label}
                placeholderTextColor={C.faint}
                accessibilityLabel="Type a town to search near"
                style={{
                  flex: 1,
                  // Without this the input keeps its content width and pushes
                  // the search button outside the sidebar.
                  minWidth: 0,
                  minHeight: 60,
                  paddingHorizontal: 14,
                  fontSize: 18 * scale,
                  color: C.ink,
                  backgroundColor: C.surface,
                  borderWidth: 2,
                  borderColor: C.line,
                  borderRadius: 14,
                  marginRight: 8,
                }}
              />
              <Pressable
                onPress={findPlace}
                accessibilityRole="button"
                accessibilityLabel="Search this town"
                style={{
                  minHeight: 60,
                  width: 60,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: C.ink,
                  borderRadius: 14,
                }}
              >
                <Ionicons name="search" size={24} color="#ffffff" />
              </Pressable>
            </View>
          </Group>

          <Group scale={scale} label="Looking for">
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              {CATEGORIES.map((option) => {
                const active = option.id === category;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => reset(setCategory, option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={option.label}
                    style={{
                      width: wide ? "100%" : "48.5%",
                      minHeight: 60,
                      marginBottom: 8,
                      paddingHorizontal: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: wide ? "flex-start" : "center",
                      borderRadius: 14,
                      backgroundColor: active ? C.ink : C.surface,
                      borderWidth: active ? 0 : 2,
                      borderColor: C.line,
                    }}
                  >
                    <Ionicons
                      name={active ? "checkmark-circle" : option.icon}
                      size={22}
                      color={active ? "#ffffff" : C.muted}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        marginLeft: 10,
                        fontSize: 17 * scale,
                        fontWeight: "600",
                        color: active ? "#ffffff" : C.ink,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* The narrowing options live in the same group as the categories.
                They combine with the category above, so keeping them in a
                separate box made it look like they replaced it. */}
            <View
              style={{ height: 1, backgroundColor: C.hair, marginTop: 6, marginBottom: 14 }}
            />

            <Check
              scale={scale}
              label={`Saved only (${saved.length})`}
              active={savedOnly}
              onPress={() => reset(setSavedOnly, !savedOnly)}
            />
            <Check
              scale={scale}
              label="No steps only"
              active={stepFreeOnly}
              onPress={() => reset(setStepFreeOnly, !stepFreeOnly)}
            />

            {filtersActive ? (
              <Pressable
                onPress={clearFilters}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                style={{
                  minHeight: 52,
                  marginTop: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: C.raised,
                }}
              >
                <Text
                  style={{ fontSize: 16 * scale, fontWeight: "700", color: C.ink }}
                >
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </Group>

          <Group scale={scale} label="Search by name" last>
            <TextInput
              value={nameQuery}
              onChangeText={(text) => reset(setNameQuery, text)}
              placeholder="For example, boxing"
              placeholderTextColor={C.faint}
              accessibilityLabel="Search events by name"
              style={{
                minHeight: 60,
                paddingHorizontal: 14,
                fontSize: 18 * scale,
                color: C.ink,
                backgroundColor: C.surface,
                borderWidth: 2,
                borderColor: C.line,
                borderRadius: 14,
              }}
            />
          </Group>
        </View>

        {/* ---------------- Results ---------------- */}
        <View style={wide ? { flex: 1 } : { marginTop: 28 }}>
          <View
            style={{
              borderRadius: 20,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: C.line,
            }}
          >
            <EventMap center={center} items={mapped} />
          </View>
          <Text
            style={{
              fontSize: 15 * scale,
              color: C.faint,
              marginTop: 10,
              marginBottom: 22,
            }}
          >
            {mapped.length} of these have a location and are marked on the map. Use +
            and − to zoom.
          </Text>

          {loading ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}
            >
              <ActivityIndicator size="large" />
              <Text style={{ fontSize: 18 * scale, color: C.muted, marginLeft: 12 }}>
                Looking near {center.label}…
              </Text>
            </View>
          ) : null}

          {status ? (
            <View
              style={{
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 14,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <Text style={{ fontSize: 17 * scale, color: C.ink }}>{status}</Text>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              marginBottom: 14,
            }}
          >
            <Text
              style={{ fontSize: 26 * scale, fontWeight: "800", color: C.ink }}
            >
              {items.length}
            </Text>
            <Text style={{ fontSize: 18 * scale, color: C.muted, marginLeft: 8 }}>
              {items.length === 1 ? "place" : "places"} near {center.label}
            </Text>
          </View>

          {items.length === 0 ? (
            <View
              style={{
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 20,
                padding: 28,
                alignItems: "center",
              }}
            >
              <Ionicons name="search-outline" size={34} color={C.faint} />
              <Text
                style={{
                  fontSize: 19 * scale,
                  lineHeight: 27 * scale,
                  fontWeight: "700",
                  color: C.ink,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                Nothing matches all of these
              </Text>

              {/* Name the filters that are on. An unexplained empty list reads
                  as a broken app rather than a narrow search. */}
              {activeFilterNames().length ? (
                <Text
                  style={{
                    fontSize: 17 * scale,
                    lineHeight: 25 * scale,
                    color: C.muted,
                    marginTop: 8,
                    textAlign: "center",
                  }}
                >
                  {activeFilterNames().join(" + ")}
                </Text>
              ) : null}

              {filtersActive ? (
                <Pressable
                  onPress={clearFilters}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all filters"
                  style={{
                    minHeight: 56,
                    marginTop: 16,
                    paddingHorizontal: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    backgroundColor: C.ink,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 17 * scale,
                      fontWeight: "700",
                      color: "#ffffff",
                    }}
                  >
                    Clear filters
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {shown.map((item) => (
            <PlaceCard
              key={item.id}
              item={item}
              scale={scale}
              onSave={() => handleSave(item.id)}
            />
          ))}

          {visible < items.length ? (
            <Pressable
              // Functional update, so a double tap advances twice rather than
              // reading a stale count and advancing once.
              onPress={() => setVisible((current) => current + PAGE)}
              accessibilityRole="button"
              accessibilityLabel="Show more places"
              style={{
                minHeight: 60,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: C.surface,
                borderWidth: 2,
                borderColor: C.line,
                borderRadius: 16,
                marginTop: 4,
              }}
            >
              <Text
                style={{ fontSize: 18 * scale, fontWeight: "600", color: C.ink }}
              >
                Show {Math.min(PAGE, items.length - visible)} more
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        style={{ height: 1, backgroundColor: C.hair, marginTop: 32, marginBottom: 14 }}
      />
      <Text style={{ fontSize: 14 * scale, lineHeight: 21 * scale, color: C.faint }}>
        Class days and times are put together by the ParkinSense team. Nearby care
        homes and centres come from OpenStreetMap, a free public map.
      </Text>
    </ScrollView>
  );
}

// A labelled group inside the sidebar, separated by a hairline instead of by
// yet another heading — keeps the panel calm.
function Group({ label, children, scale, first, last }) {
  return (
    <View
      style={{
        paddingTop: first ? 0 : 18,
        paddingBottom: last ? 0 : 18,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "#e2e8f0",
      }}
    >
      <Text
        style={{
          fontSize: 13 * scale,
          fontWeight: "700",
          letterSpacing: 0.9,
          textTransform: "uppercase",
          color: C.faint,
          marginBottom: 10,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

// Says what it does in words and shows a box state, so it never relies on
// colour alone.
function Check({ label, active, onPress, scale }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={{
        minHeight: 60,
        paddingHorizontal: 14,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        backgroundColor: active ? C.ink : C.surface,
        borderWidth: active ? 0 : 2,
        borderColor: C.line,
      }}
    >
      <Ionicons
        name={active ? "checkbox" : "square-outline"}
        size={22}
        color={active ? "#ffffff" : C.muted}
      />
      <Text
        style={{
          marginLeft: 10,
          fontSize: 17 * scale,
          fontWeight: "600",
          color: active ? "#ffffff" : C.ink,
          flex: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PlaceCard({ item, onSave, scale }) {
  const good = item.timing?.fit === "good";

  const speech = [
    item.name,
    item.venue,
    item.day ? `${item.day} at ${item.time}` : "",
    // Only mention timing when there is something to flag, matching the card.
    item.timing && !good ? item.timing.label : "",
    item.miles === null ? "Online" : `${item.miles.toFixed(1)} miles away`,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 20,
        padding: 20,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text
            style={{
              fontSize: 23 * scale,
              lineHeight: 29 * scale,
              fontWeight: "700",
              letterSpacing: -0.2,
              color: C.ink,
            }}
          >
            {item.name}
          </Text>
          <Text
            style={{ fontSize: 17 * scale, color: C.muted, marginTop: 3 }}
          >
            {item.venue}
            {item.address ? `, ${item.address}` : ""}
          </Text>
        </View>
        {item.day ? (
          <View
            style={{
              backgroundColor: "#f1f5f9",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              alignItems: "center",
            }}
          >
            <Text
              style={{ fontSize: 14 * scale, fontWeight: "700", color: C.muted }}
            >
              {item.day.slice(0, 3).toUpperCase()}
            </Text>
            <Text
              style={{ fontSize: 16 * scale, fontWeight: "700", color: C.ink }}
            >
              {item.time.replace(":00", "")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Timing against this patient's own levels. Only shown when there is
          something to flag — a good time needs no announcement, and staying
          quiet keeps the warnings meaningful. */}
      {item.timing && !good ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            backgroundColor: C.warnBg,
            borderRadius: 14,
            padding: 13,
            marginTop: 14,
          }}
        >
          <Ionicons name="alert-circle" size={22} color={C.warn} />
          <Text
            style={{
              marginLeft: 9,
              flex: 1,
              fontSize: 16 * scale,
              lineHeight: 23 * scale,
              fontWeight: "600",
              color: C.warn,
            }}
          >
            {item.timing.fit === "poor"
              ? "This may be a harder time of day for you"
              : "Your levels are often high at this time"}
          </Text>
        </View>
      ) : null}

      {item.note ? (
        <Text
          style={{
            fontSize: 17 * scale,
            lineHeight: 25 * scale,
            color: C.muted,
            marginTop: 12,
          }}
        >
          {item.note}
        </Text>
      ) : null}

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}
      >
        {item.miles === null ? (
          <Fact scale={scale} icon="globe" label="Online — no travel" />
        ) : (
          <Fact scale={scale} icon="navigate" label={`${item.miles.toFixed(1)} miles`} />
        )}
        {item.stepFree ? <Fact scale={scale} icon="accessibility" label="No steps" /> : null}
        {item.seated ? <Fact scale={scale} icon="body" label="Can sit down" /> : null}
        {item.caregiverWelcome ? (
          <Fact scale={scale} icon="people" label="Bring a partner" />
        ) : null}
        {item.virtual ? <Fact scale={scale} icon="videocam" label="Join online" /> : null}
      </View>

      <View style={{ height: 1, backgroundColor: C.hair, marginTop: 16 }} />

      {/* Labelled, not a bare icon — a lone star is easy to misread */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityState={{ selected: item.isSaved }}
          accessibilityLabel={
            item.isSaved
              ? `Remove ${item.name} from my list`
              : `Save ${item.name} to my list`
          }
          style={{
            flex: 1,
            minHeight: 60,
            marginRight: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            backgroundColor: item.isSaved ? C.savedBg : "#f1f5f9",
            borderWidth: 2,
            borderColor: item.isSaved ? "#fbbf24" : C.line,
          }}
        >
          <Ionicons
            name={item.isSaved ? "star" : "star-outline"}
            size={22}
            color={item.isSaved ? C.savedInk : C.muted}
          />
          <Text
            style={{
              marginLeft: 8,
              fontSize: 17 * scale,
              fontWeight: "700",
              color: item.isSaved ? C.savedInk : C.ink,
            }}
          >
            {item.isSaved ? "Saved" : "Save"}
          </Text>
        </Pressable>

        <SpeakButton text={speech} label={`Read ${item.name} aloud`} />
      </View>
    </View>
  );
}

function Fact({ icon, label, scale }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f1f5f9",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Ionicons name={icon} size={16} color={C.muted} />
      <Text style={{ marginLeft: 6, fontSize: 15 * scale, color: C.muted }}>
        {label}
      </Text>
    </View>
  );
}
