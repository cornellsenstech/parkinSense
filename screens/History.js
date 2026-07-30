import { useContext, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import LevelLineChart, {
  ChartFooter,
  ChartLegend,
} from "../components/LevelLineChart";
import SymptomHistoryChart from "../components/SymptomHistoryChart";
import SymptomTable from "../components/SymptomTable";
import MealChart from "../components/MealChart";
import { chronological, loadEntries } from "../data/symptomLog";
import {
  PROTEIN_LEVELS,
  doseProximity,
  loadMeals,
  proteinLabel,
  setMealProtein,
} from "../data/mealLog";
import { SYMPTOMS, sleepLabel } from "../data/symptoms";
import { Ionicons } from "@expo/vector-icons";
import { page, useWide } from "../components/layout";
import {
  RANGE_HIGH,
  RANGE_LOW,
  getHistory,
  levelTone,
} from "../data/history";
import { RoleContext } from "../context/RoleContext";
import { AccessibilityContext } from "../context/AccessibilityContext";

export default function History() {
  const { user } = useContext(RoleContext);
  const readings = getHistory(user);

  // The patient's own saved check-ins and meals, rather than anything derived.
  const [checkIns, setCheckIns] = useState([]);
  const [meals, setMeals] = useState([]);

  useEffect(() => {
    loadEntries(user).then((list) => setCheckIns(chronological(list)));
    loadMeals(user).then(setMeals);
  }, [user]);

  const wide = useWide();
  const { scale } = useContext(AccessibilityContext);

  async function fillProtein(mealId, protein) {
    await setMealProtein(user, mealId, protein);
    setMeals(await loadMeals(user));
  }
  const [view, setView] = useState("Concentration");
  const [selected, setSelected] = useState(readings[readings.length - 1]);

  const showLevels = view === "Concentration";
  const showMeals = view === "Meals";
  const days = [...new Set(readings.map((r) => r.day))];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={page()}
    >
      <Text
        className="font-bold text-gray-900"
        style={{ fontSize: 34 * scale, lineHeight: 40 * scale }}
      >
        History
      </Text>
      <Text
        className="font-black text-gray-900 mb-5"
        style={{ fontSize: 34 * scale, lineHeight: 40 * scale }}
      >
        Overview
      </Text>

      {/* Switches both the graph and the list below it */}
      <View className="flex-row bg-white rounded-xl border border-gray-200 p-1 mb-4">
        {["Concentration", "Symptoms", "Meals"].map((option) => {
          const active = option === view;
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`flex-1 items-center justify-center rounded-lg ${
                active ? "bg-gray-100" : ""
              }`}
              style={{ minHeight: 44 }}
            >
              <Text
                className={`text-base ${
                  active ? "font-bold text-gray-900" : "text-gray-500"
                }`}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* One graph at a time, matching the selection above */}
      <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-5">
        {showMeals ? (
          <MealStats meals={meals} scale={scale} />
        ) : showLevels ? (
          <>
            <ChartLegend />
            {selected ? (
              <View className="self-center border-2 border-gray-300 rounded-2xl px-5 py-3 mb-3 bg-white">
                <Text className="text-xl font-bold text-gray-900 text-center">
                  {selected.level} ng/mL
                </Text>
                <Text
                  className="text-base font-semibold text-center"
                  style={{ color: levelTone(selected.level).color }}
                >
                  {levelTone(selected.level).label}
                </Text>
                <Text className="text-sm text-gray-500 text-center">
                  {selected.time}
                </Text>
              </View>
            ) : null}
            <LevelLineChart
              data={readings}
              selectedId={selected ? selected.id : null}
              onSelect={setSelected}
            />
            <ChartFooter days={days} />
          </>
        ) : (
          <>
            <Text className="text-xl font-bold text-gray-900 mb-3">
              Symptoms over time
            </Text>
            <SymptomHistoryChart entries={checkIns} scale={scale} />
          </>
        )}
      </View>

      {/* Summary numbers for whichever view is showing */}
      {showMeals ? null : showLevels ? (
        <LevelStats readings={readings} />
      ) : (
        <SymptomStats entries={checkIns} />
      )}

      {/* The matching list */}
      {showMeals ? null : showLevels
        ? days
            .slice()
            .reverse()
            .map((day) => (
              <View key={day}>
                <Text className="text-base font-semibold text-gray-700 mb-2 mt-1">
                  {day}
                </Text>
                {/* Two per row on a wide screen — 48 readings in a single
                    column is a very long scroll. */}
                <View
                  style={
                    wide
                      ? { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }
                      : null
                  }
                >
                  {readings
                    .filter((r) => r.day === day)
                    .slice()
                    .reverse()
                    .map((reading) => (
                      <ReadingRow key={reading.id} reading={reading} wide={wide} />
                    ))}
                </View>
              </View>
            ))
        : (
            <View className="bg-white rounded-2xl border border-gray-200 p-4">
              <SymptomTable
                entries={[...checkIns].reverse()}
                scale={scale}
              />
            </View>
          )}

      {/* Meals, because protein competes with levodopa for absorption */}
      {showMeals && meals.length ? (
        <View style={{ marginTop: 22 }}>
          {groupByDate(meals).map((group) => (
            <View key={group.label}>
              <Text
                className="font-bold text-gray-900 mb-2 mt-3"
                style={{ fontSize: 18 * scale }}
              >
                {group.label}
              </Text>
              {group.items.map((meal) => {
            const near = doseProximity(meal);
            return (
              <View
                key={meal.id}
                className="bg-white rounded-2xl border border-gray-200 px-4 py-3 mb-2"
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={near?.flag ? "alert-circle" : "restaurant-outline"}
                    size={20}
                    color={near?.flag ? "#9a3412" : "#64748b"}
                  />
                  <Text
                    className="text-gray-900 ml-2 flex-1"
                    style={{ fontSize: 17 * scale }}
                  >
                    {meal.timeLabel}
                    {meal.food ? ` · ${meal.food}` : ""}
                  </Text>
                  <Text
                    className="text-gray-600"
                    style={{ fontSize: 15 * scale }}
                  >
                    {proteinLabel(meal.protein)}
                  </Text>
                </View>

                {near?.flag ? (
                  <Text
                    style={{
                      fontSize: 15 * scale,
                      color: "#9a3412",
                      marginTop: 4,
                    }}
                  >
                    About {near.minutes} minutes from the {near.doseLabel} dose
                  </Text>
                ) : null}

                {/* Meals logged as "not sure" can be filled in here afterwards,
                    by the patient or whoever is helping them. */}
                {meal.protein === "unsure" ? (
                  <View style={{ marginTop: 10 }}>
                    <Text
                      className="text-gray-600 mb-2"
                      style={{ fontSize: 15 * scale }}
                    >
                      How much protein was in this?
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {PROTEIN_LEVELS.filter((p) => p.id !== "unsure").map(
                        (level) => (
                          <Pressable
                            key={level.id}
                            onPress={() => fillProtein(meal.id, level.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`Set to ${level.label}`}
                            style={{
                              minHeight: 48,
                              paddingHorizontal: 14,
                              marginRight: 8,
                              marginBottom: 8,
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 10,
                              backgroundColor: "#f1f5f9",
                              borderWidth: 1,
                              borderColor: "#cbd5e1",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 15 * scale,
                                fontWeight: "600",
                                color: "#0f172a",
                              }}
                            >
                              {level.label}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  </View>
                ) : null}
              </View>
            );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

// Groups entries under a date heading, newest day first, so a fortnight of meals
// reads as days rather than one undifferentiated list.
function groupByDate(items) {
  const groups = new Map();
  items.forEach((item) => {
    const at = new Date(item.eatenAt ?? item.savedAt);
    const key = at.toDateString();
    if (!groups.has(key)) {
      groups.set(key, { label: labelForDate(at), at: at.getTime(), items: [] });
    }
    groups.get(key).items.push(item);
  });
  return [...groups.values()].sort((a, b) => b.at - a.at);
}

function labelForDate(date) {
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function LevelStats({ readings }) {
  const average = Math.round(
    readings.reduce((sum, r) => sum + r.level, 0) / readings.length
  );
  const inRange = readings.filter(
    (r) => r.level >= RANGE_LOW && r.level <= RANGE_HIGH
  ).length;
  const percent = Math.round((inRange / readings.length) * 100);

  return (
    <View className="flex-row bg-white rounded-2xl border border-gray-200 mb-5">
      <Stat value={average} label="Avg ng/mL" />
      <Stat value={`${percent}%`} label="Time in range" divider />
      <Stat value={readings.length} label="Readings" divider />
    </View>
  );
}

// Summary for the Meals tab. The figure that matters clinically is how often a
// high-protein meal landed close to a dose, since that is when absorption is
// actually affected.
function MealStats({ meals, scale }) {
  const [chartWidth, setChartWidth] = useState(320);

  if (!meals.length) {
    return (
      <Text style={{ fontSize: 16 * scale, color: "#64748b" }}>
        No meals logged yet. Anything you record on the Home tab appears here.
      </Text>
    );
  }

  const highProtein = meals.filter((m) => m.protein === "high").length;
  const clashes = meals.filter((m) => doseProximity(m)?.flag).length;
  const unsure = meals.filter((m) => m.protein === "unsure").length;

  return (
    <View>
      <Text
        className="font-bold text-gray-900 mb-3"
        style={{ fontSize: 20 * scale }}
      >
        Meals and your medication
      </Text>

      {/* Protein across the day, against the dose times.
          Starts at a sensible width rather than rendering nothing: with a null
          child the wrapper had no layout, so onLayout never fired and the chart
          never appeared. */}
      <View
        style={{ width: "100%" }}
        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
      >
        <MealChart meals={meals} width={chartWidth} scale={scale} />
      </View>

      <View className="flex-row mt-3">
        <Stat value={meals.length} label="Meals logged" />
        <Stat value={highProtein} label="High protein" divider />
        <Stat value={clashes} label="Close to a dose" divider />
      </View>

      <Text
        style={{
          fontSize: 16 * scale,
          lineHeight: 23 * scale,
          color: "#475569",
          marginTop: 12,
        }}
      >
        {clashes > 0
          ? `${clashes} high-protein ${
              clashes === 1 ? "meal" : "meals"
            } fell within an hour of a dose. Protein competes with your medication for absorption, so those doses may have worked less well.`
          : "No high-protein meals fell close to a dose, so absorption is unlikely to have been affected."}
      </Text>

      {unsure > 0 ? (
        <Text
          style={{ fontSize: 15 * scale, color: "#9a3412", marginTop: 8 }}
        >
          {unsure} {unsure === 1 ? "meal is" : "meals are"} still marked “not
          sure”. You can fill those in below.
        </Text>
      ) : null}
    </View>
  );
}

function SymptomStats({ entries }) {
  if (!entries.length) {
    return (
      <View className="flex-row bg-white rounded-2xl border border-gray-200 mb-5">
        <Stat value="0" label="Check-ins" />
      </View>
    );
  }

  // The worst score across every symptom, not just the motor ones.
  const worst = Math.max(
    ...entries.map((e) => Math.max(...Object.values(e.scores || { x: 0 })))
  );
  const byCaregiver = entries.filter((e) => e.by === "caregiver").length;

  return (
    <View className="flex-row bg-white rounded-2xl border border-gray-200 mb-5">
      <Stat value={entries.length} label="Check-ins" />
      <Stat value={`${worst}/4`} label="Worst score" divider />
      <Stat value={byCaregiver} label="By caregiver" divider />
    </View>
  );
}

// Reads the text-size setting itself rather than having it threaded through
// LevelStats and SymptomStats, which do not otherwise care about it.
function Stat({ value, label, divider }) {
  const { scale } = useContext(AccessibilityContext);
  return (
    <View
      className={`flex-1 items-center py-4 ${divider ? "border-l border-gray-200" : ""}`}
    >
      <Text
        className="font-bold text-gray-900"
        style={{ fontSize: 22 * scale }}
      >
        {value}
      </Text>
      <Text className="text-gray-500 mt-0.5" style={{ fontSize: 14 * scale }}>
        {label}
      </Text>
    </View>
  );
}

function ReadingRow({ reading, wide }) {
  const tone = levelTone(reading.level);
  return (
    <View
      className="bg-white rounded-2xl border border-gray-200 px-4 py-3 mb-2"
      style={wide ? { width: "49%" } : null}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-end">
          <Text className="text-2xl font-bold text-gray-900">{reading.level}</Text>
          <Text className="text-sm text-gray-500 ml-1 mb-1">ng/mL</Text>
        </View>
        <Text className="text-sm text-gray-500">{reading.time}</Text>
      </View>
      <View className="flex-row items-center mt-1">
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone.color }}
        />
        <Text className="text-sm ml-2" style={{ color: tone.color }}>
          {tone.label}
        </Text>
      </View>
    </View>
  );
}

