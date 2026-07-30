import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import {
  PROTEIN_LEVELS,
  WHEN_OPTIONS,
  doseProximity,
  loadMeals,
  proteinLabel,
  removeMeal,
  saveMeal,
} from "../data/mealLog";
import SpeakButton from "./SpeakButton";

const UNDO_SECONDS = 20;

// Meal logging, because dietary protein competes with levodopa for the same
// transporter. Recording the time is the point: the same meal matters a lot an
// hour after a dose and very little three hours later.
export default function MealLogCard({ patientId }) {
  const { scale } = useContext(AccessibilityContext);

  const [protein, setProtein] = useState("low");
  const [when, setWhen] = useState("now");
  const [meals, setMeals] = useState([]);
  const [justSaved, setJustSaved] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const undoTimer = useRef(null);

  useEffect(() => {
    loadMeals(patientId).then(setMeals);
    return () => clearTimeout(undoTimer.current);
  }, [patientId]);

  async function handleSave() {
    const option = WHEN_OPTIONS.find((w) => w.id === when);
    const entry = await saveMeal(patientId, {
      protein,
      minutesAgo: option ? option.minutesAgo : 0,
    });
    if (!entry) return;

    setMeals(await loadMeals(patientId));
    setJustSaved(entry);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setJustSaved(null), UNDO_SECONDS * 1000);
  }

  async function handleUndo() {
    if (!justSaved) return;
    clearTimeout(undoTimer.current);
    await removeMeal(patientId, justSaved.id);
    setMeals(await loadMeals(patientId));
    setJustSaved(null);
  }

  const savedProximity = doseProximity(justSaved);
  const today = meals.slice(0, 4);

  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 24 * scale,
              lineHeight: 30 * scale,
              fontWeight: "700",
              color: "#0f172a",
            }}
          >
            What have you eaten?
          </Text>
          <Text
            style={{ fontSize: 16 * scale, color: "#475569", marginTop: 2 }}
          >
            Protein can get in the way of your medicine
          </Text>
        </View>

        <Pressable
          onPress={() => setShowInfo(!showInfo)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showInfo }}
          accessibilityLabel="Why does food matter?"
          style={{
            width: 48,
            height: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            backgroundColor: showInfo ? "#0f172a" : "#f1f5f9",
            borderWidth: 1,
            borderColor: showInfo ? "#0f172a" : "#cbd5e1",
          }}
        >
          <Ionicons
            name="information"
            size={24}
            color={showInfo ? "#ffffff" : "#334155"}
          />
        </Pressable>
      </View>

      {showInfo ? (
        <View
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: "#cbd5e1",
          }}
        >
          <Text
            style={{ fontSize: 17 * scale, lineHeight: 25 * scale, color: "#3d5257" }}
          >
            Your medicine is absorbed in the gut by the same carrier that handles
            protein from food. When a lot of protein arrives at the same time,
            less of the medicine gets through, so a dose can feel weaker or take
            longer to work.
          </Text>
          <Text
            style={{
              fontSize: 17 * scale,
              lineHeight: 25 * scale,
              color: "#3d5257",
              marginTop: 12,
            }}
          >
            Recording the time is what makes this useful. The same meal matters a
            lot an hour after a dose and very little three hours later. Logging it
            helps your care team see whether meals explain a weaker day.
          </Text>
          <Text
            style={{
              fontSize: 17 * scale,
              lineHeight: 25 * scale,
              fontWeight: "700",
              color: "#9a3412",
              marginTop: 12,
            }}
          >
            Do not cut protein out of your diet. You need it. Any change to when
            you eat or when you take your medicine is a conversation with your
            care team.
          </Text>
        </View>
      ) : null}

      {/* How much protein */}
      <Text
        style={{
          fontSize: 17 * scale,
          fontWeight: "700",
          color: "#0f172a",
          marginTop: 18,
          marginBottom: 8,
        }}
      >
        How much protein?
      </Text>
      {PROTEIN_LEVELS.map((level) => {
        const active = level.id === protein;
        return (
          <Pressable
            key={level.id}
            onPress={() => setProtein(level.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${level.label}. For example ${level.example}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 64,
              paddingHorizontal: 14,
              marginBottom: 8,
              borderRadius: 14,
              backgroundColor: active ? "#0f172a" : "#ffffff",
              borderWidth: active ? 0 : 2,
              borderColor: "#cbd5e1",
            }}
          >
            <Ionicons
              name={active ? "radio-button-on" : "radio-button-off"}
              size={24}
              color={active ? "#ffffff" : "#475569"}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text
                style={{
                  fontSize: 17 * scale,
                  fontWeight: "700",
                  color: active ? "#ffffff" : "#0f172a",
                }}
              >
                {level.label}
              </Text>
              <Text
                style={{
                  fontSize: 14 * scale,
                  color: active ? "#cbd5e1" : "#64748b",
                }}
              >
                {level.example}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {/* When — taps rather than a time picker */}
      <Text
        style={{
          fontSize: 17 * scale,
          fontWeight: "700",
          color: "#0f172a",
          marginTop: 10,
          marginBottom: 8,
        }}
      >
        When did you eat?
      </Text>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}
      >
        {WHEN_OPTIONS.map((option) => {
          const active = option.id === when;
          return (
            <Pressable
              key={option.id}
              onPress={() => setWhen(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              style={{
                width: "48.5%",
                minHeight: 60,
                marginBottom: 8,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                backgroundColor: active ? "#0f172a" : "#ffffff",
                borderWidth: active ? 0 : 2,
                borderColor: "#cbd5e1",
              }}
            >
              <Text
                style={{
                  fontSize: 16 * scale,
                  fontWeight: "700",
                  color: active ? "#ffffff" : "#0f172a",
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleSave}
        accessibilityRole="button"
        accessibilityLabel="Save this meal"
        style={{
          minHeight: 56,
          marginTop: 4,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          backgroundColor: "#0f172a",
        }}
      >
        <Text style={{ fontSize: 18 * scale, fontWeight: "700", color: "#ffffff" }}>
          Save meal
        </Text>
      </Pressable>

      {/* Confirmation, with undo and the dose-timing note */}
      {justSaved ? (
        <View
          style={{
            backgroundColor: savedProximity?.flag ? "#ffedd5" : "#dcfce7",
            borderRadius: 16,
            padding: 14,
            marginTop: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name={savedProximity?.flag ? "alert-circle" : "checkmark-circle"}
              size={26}
              color={savedProximity?.flag ? "#9a3412" : "#166534"}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text
                style={{
                  fontSize: 18 * scale,
                  fontWeight: "700",
                  color: savedProximity?.flag ? "#9a3412" : "#166534",
                }}
              >
                Saved at {justSaved.timeLabel}
              </Text>
              <Text
                style={{
                  fontSize: 15 * scale,
                  color: savedProximity?.flag ? "#9a3412" : "#166534",
                }}
              >
                {proteinLabel(justSaved.protein)}
              </Text>
            </View>
            <Pressable
              onPress={handleUndo}
              accessibilityRole="button"
              accessibilityLabel="Undo this meal"
              style={{
                minHeight: 52,
                paddingHorizontal: 18,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: "#ffffff",
                borderWidth: 2,
                borderColor: savedProximity?.flag ? "#fdba74" : "#86efac",
              }}
            >
              <Text
                style={{
                  fontSize: 17 * scale,
                  fontWeight: "700",
                  color: savedProximity?.flag ? "#9a3412" : "#166534",
                }}
              >
                Undo
              </Text>
            </Pressable>
          </View>

          {savedProximity?.flag ? (
            <Text
              style={{
                fontSize: 16 * scale,
                lineHeight: 23 * scale,
                color: "#9a3412",
                marginTop: 10,
              }}
            >
              That was about {savedProximity.minutes} minutes from your{" "}
              {savedProximity.doseLabel} dose. A lot of protein that close can make
              a dose work less well. Worth mentioning to your care team.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Recent meals */}
      {today.length ? (
        <View style={{ marginTop: 18 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
          >
            <Text
              style={{ flex: 1, fontSize: 17 * scale, fontWeight: "700", color: "#0f172a" }}
            >
              Recent meals
            </Text>
            <SpeakButton
              text={`Recent meals. ${today
                .map((m) => `${m.timeLabel}, ${proteinLabel(m.protein)}`)
                .join(". ")}`}
              label="Read recent meals aloud"
            />
          </View>

          {today.map((meal) => {
            const near = doseProximity(meal);
            return (
              <View
                key={meal.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: "#e2e8f0",
                }}
              >
                <Ionicons
                  name={near?.flag ? "alert-circle" : "restaurant-outline"}
                  size={20}
                  color={near?.flag ? "#9a3412" : "#64748b"}
                />
                <Text
                  style={{
                    marginLeft: 10,
                    flex: 1,
                    fontSize: 16 * scale,
                    color: "#0f172a",
                  }}
                >
                  {meal.timeLabel} · {proteinLabel(meal.protein)}
                </Text>
                {near?.flag ? (
                  <Text
                    style={{ fontSize: 14 * scale, fontWeight: "700", color: "#9a3412" }}
                  >
                    near dose
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
