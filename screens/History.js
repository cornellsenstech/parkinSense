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
import { getHistory, levelTone, rangeFor } from "../data/history";
import {
  exerciseSummary,
  intensity,
  loadExercise,
} from "../data/exerciseLog";
import { doseKind, doseSummary, loadDoses } from "../data/doseLog";
import { RoleContext } from "../context/RoleContext";
import { AccessibilityContext } from "../context/AccessibilityContext";

const VIEWS = ["Concentration", "Symptoms", "Meals", "Activity", "Doses"];

export default function History() {
  const { user } = useContext(RoleContext);
  const readings = getHistory(user);

  // Everything the patient actually recorded, rather than anything derived.
  const [checkIns, setCheckIns] = useState([]);
  const [meals, setMeals] = useState([]);
  const [exercise, setExercise] = useState([]);
  const [doses, setDoses] = useState([]);

  useEffect(() => {
    loadEntries(user).then((list) => setCheckIns(chronological(list)));
    loadMeals(user).then(setMeals);
    loadExercise(user).then(setExercise);
    loadDoses(user).then(setDoses);
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
  const showSymptoms = view === "Symptoms";
  const showMeals = view === "Meals";
  const showActivity = view === "Activity";
  const showDoses = view === "Doses";
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

      {/* Switches both the graph and the list below it. Five options wrap
          rather than squeezing into one row — at phone width, five equal
          segments give labels nobody can read. */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        {VIEWS.map((option) => {
          const active = option === view;
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option}
              style={{
                minHeight: 46,
                justifyContent: "center",
                paddingHorizontal: 16,
                marginRight: 8,
                marginBottom: 8,
                borderRadius: 23,
                backgroundColor: active ? "#0f172a" : "#ffffff",
                borderWidth: 1,
                borderColor: active ? "#0f172a" : "#d1d5db",
              }}
            >
              <Text
                style={{
                  fontSize: 16 * scale,
                  fontWeight: active ? "700" : "500",
                  color: active ? "#ffffff" : "#475569",
                }}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* One graph at a time, matching the selection above */}
      <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-5">
        {showLevels ? (
          <>
            <ChartLegend />
            {selected ? (
              <View className="self-center border-2 border-gray-300 rounded-2xl px-5 py-3 mb-3 bg-white">
                <Text className="text-xl font-bold text-gray-900 text-center">
                  {selected.level} ng/mL
                </Text>
                <Text
                  className="text-base font-semibold text-center"
                  style={{ color: levelTone(selected.level, user).color }}
                >
                  {levelTone(selected.level, user).label}
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
              patientId={user}
            />
            <ChartFooter days={days} />
          </>
        ) : showSymptoms ? (
          <>
            <Text className="text-xl font-bold text-gray-900 mb-3">
              Symptoms over time
            </Text>
            <SymptomHistoryChart entries={checkIns} scale={scale} />
          </>
        ) : showMeals ? (
          <MealStats meals={meals} scale={scale} />
        ) : showActivity ? (
          <ActivityStats entries={exercise} scale={scale} />
        ) : (
          <DoseStats entries={doses} scale={scale} />
        )}
      </View>

      {/* Summary numbers for whichever view is showing */}
      {showLevels ? <LevelStats readings={readings} patientId={user} /> : null}
      {showSymptoms ? <SymptomStats entries={checkIns} /> : null}

      {/* The matching list */}
      {showLevels
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
        : null}

      {showSymptoms ? (
        <View className="bg-white rounded-2xl border border-gray-200 p-4">
          <SymptomTable entries={[...checkIns].reverse()} scale={scale} />
        </View>
      ) : null}

      {/* Meals, because protein competes with levodopa for absorption */}
      {showMeals && meals.length ? (
        <DateGroups items={meals} scale={scale}>
          {(meal) => {
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
                    style={{ fontSize: 17 * scale, minWidth: 0 }}
                  >
                    {meal.timeLabel}
                    {meal.food ? ` · ${meal.food}` : ""}
                  </Text>
                  <Text className="text-gray-600" style={{ fontSize: 15 * scale }}>
                    {proteinLabel(meal.protein)}
                  </Text>
                </View>

                {near?.flag ? (
                  <Text
                    style={{ fontSize: 15 * scale, color: "#9a3412", marginTop: 4 }}
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
                      {PROTEIN_LEVELS.filter((p) => p.id !== "unsure").map((level) => (
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
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        </DateGroups>
      ) : null}

      {/* Activity, sectioned the same way as meals */}
      {showActivity && exercise.length ? (
        <DateGroups items={exercise} scale={scale}>
          {(item) => {
            const level = intensity(item.level);
            return (
              <View
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 px-4 py-3 mb-2"
              >
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: level.colour,
                    }}
                  />
                  <Text
                    className="text-gray-900 ml-2 flex-1"
                    style={{ fontSize: 17 * scale, minWidth: 0 }}
                  >
                    {item.timeLabel} · {item.activity}
                  </Text>
                  <Text className="text-gray-600" style={{ fontSize: 15 * scale }}>
                    {item.minutes} min · {level.label}
                  </Text>
                </View>
              </View>
            );
          }}
        </DateGroups>
      ) : null}

      {/* Doses: taken, missed and rescue, which is what separates a normal
          pre-dose trough from having no medication on board */}
      {showDoses && doses.length ? (
        <DateGroups items={doses} scale={scale}>
          {(item) => {
            const kind = doseKind(item.kind);
            return (
              <View
                key={item.id}
                className="bg-white rounded-2xl border border-gray-200 px-4 py-3 mb-2"
              >
                <View className="flex-row items-center">
                  <Ionicons name={kind.icon} size={20} color={kind.colour} />
                  <Text
                    className="text-gray-900 ml-2 flex-1"
                    style={{ fontSize: 17 * scale, minWidth: 0 }}
                  >
                    {item.timeLabel} · {kind.short}
                  </Text>
                  <Text className="text-gray-600" style={{ fontSize: 15 * scale }}>
                    {item.by === "caregiver" ? "caregiver" : "patient"}
                  </Text>
                </View>
                {item.note ? (
                  <Text
                    style={{ fontSize: 15 * scale, color: "#475569", marginTop: 4 }}
                  >
                    {item.note}
                  </Text>
                ) : null}
              </View>
            );
          }}
        </DateGroups>
      ) : null}

    </ScrollView>
  );
}

// Meals, activity and doses are three different stores with the same shape of
// problem — a fortnight of entries reading as one undifferentiated list — so
// they share one date-grouped renderer rather than three copies of it.
function DateGroups({ items, scale, children }) {
  return (
    <View style={{ marginTop: 22 }}>
      {groupByDate(items).map((group) => (
        <View key={group.label}>
          <Text
            className="font-bold text-gray-900 mb-2 mt-3"
            style={{ fontSize: 18 * scale }}
          >
            {group.label}
          </Text>
          {group.items.map((item) => children(item))}
        </View>
      ))}
    </View>
  );
}

// Groups entries under a date heading, newest day first. Each store names its
// timestamp differently, so all four are accepted here rather than forcing a
// rename across the data layer.
function groupByDate(items) {
  const groups = new Map();
  items.forEach((item) => {
    const at = new Date(
      item.eatenAt ?? item.doneAt ?? item.takenAt ?? item.savedAt
    );
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

function LevelStats({ readings, patientId }) {
  const { low, high } = rangeFor(patientId);
  const average = Math.round(
    readings.reduce((sum, r) => sum + r.level, 0) / readings.length
  );
  const inRange = readings.filter(
    (r) => r.level >= low && r.level <= high
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

// Summary for the Activity tab. Active days leads, ahead of total minutes,
// because consistency is what the evidence supports — one long session on a
// Sunday is not the same as moving on five days.
function ActivityStats({ entries, scale }) {
  if (!entries.length) {
    return (
      <Text style={{ fontSize: 16 * scale, color: "#64748b" }}>
        No activity logged yet. Anything you record on the Home tab appears here.
      </Text>
    );
  }

  const week = exerciseSummary(entries, 7);
  const fortnight = exerciseSummary(entries, 14);

  return (
    <View>
      <Text
        className="font-bold text-gray-900 mb-3"
        style={{ fontSize: 20 * scale }}
      >
        Movement and exercise
      </Text>

      <View className="flex-row">
        <Stat value={`${week.activeDays}/7`} label="Active days" />
        <Stat value={week.totalMinutes} label="Minutes, 7 days" divider />
        <Stat value={fortnight.sessions} label="Sessions, 14 days" divider />
      </View>

      <Text
        style={{
          fontSize: 16 * scale,
          lineHeight: 23 * scale,
          color: "#475569",
          marginTop: 12,
        }}
      >
        Regular activity is the one thing outside medication with good evidence
        behind it in Parkinson's. Logged here so you and your care team can see
        whether the better days are the active ones — {week.moderateMinutes} of
        the last week's minutes were moderate or harder.
      </Text>
    </View>
  );
}

// Summary for the Doses tab. Adherence deliberately excludes rescue doses:
// taking an extra dose is not the same as taking a scheduled one, and counting
// them together would hide both facts.
function DoseStats({ entries, scale }) {
  if (!entries.length) {
    return (
      <Text style={{ fontSize: 16 * scale, color: "#64748b" }}>
        No doses logged yet. Record them on the Home tab and they appear here.
      </Text>
    );
  }

  const week = doseSummary(entries, 7);

  return (
    <View>
      <Text
        className="font-bold text-gray-900 mb-3"
        style={{ fontSize: 20 * scale }}
      >
        Doses, last 7 days
      </Text>

      <View className="flex-row">
        <Stat value={week.taken} label="Taken" />
        <Stat value={week.missed} label="Missed" divider />
        <Stat value={week.rescue} label="Extra doses" divider />
      </View>

      <Text
        style={{
          fontSize: 16 * scale,
          lineHeight: 23 * scale,
          color: "#475569",
          marginTop: 12,
        }}
      >
        {week.adherence != null
          ? `${week.adherence}% of your scheduled doses were logged as taken.`
          : "No scheduled doses logged yet this week."}{" "}
        Extra doses are counted separately, because an unscheduled dose usually
        means an off period broke through rather than that a dose was late.
      </Text>
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

