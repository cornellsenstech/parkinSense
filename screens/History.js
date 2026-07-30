import { useContext, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import LevelLineChart, {
  ChartFooter,
  ChartLegend,
} from "../components/LevelLineChart";
import SymptomChart from "../components/SymptomChart";
import { page, useWide } from "../components/layout";
import {
  RANGE_HIGH,
  RANGE_LOW,
  getHistory,
  getSymptomLog,
  levelTone,
} from "../data/history";
import { RoleContext } from "../context/RoleContext";
import { AccessibilityContext } from "../context/AccessibilityContext";

export default function History() {
  const { user } = useContext(RoleContext);
  const readings = getHistory(user);
  const symptoms = getSymptomLog(user);

  const wide = useWide();
  const { scale } = useContext(AccessibilityContext);
  const [view, setView] = useState("Concentration");
  const [selected, setSelected] = useState(readings[readings.length - 1]);

  const showLevels = view === "Concentration";
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
        {["Concentration", "Symptoms"].map((option) => {
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
            <SymptomChart entries={symptoms} />
          </>
        )}
      </View>

      {/* Summary numbers for whichever view is showing */}
      {showLevels ? (
        <LevelStats readings={readings} />
      ) : (
        <SymptomStats entries={symptoms} />
      )}

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
        : symptoms
            .slice()
            .reverse()
            .map((entry) => <SymptomRow key={entry.id} entry={entry} />)}
    </ScrollView>
  );
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

function SymptomStats({ entries }) {
  const mean = (key) =>
    (entries.reduce((sum, e) => sum + e[key], 0) / entries.length).toFixed(1);
  const worst = Math.max(...entries.map((e) => Math.max(e.stiffness, e.tremor)));

  return (
    <View className="flex-row bg-white rounded-2xl border border-gray-200 mb-5">
      <Stat value={mean("stiffness")} label="Avg stiffness" />
      <Stat value={mean("tremor")} label="Avg tremor" divider />
      <Stat value={`${worst}/4`} label="Worst" divider />
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

function SymptomRow({ entry }) {
  return (
    <View className="bg-white rounded-2xl border border-gray-200 px-4 py-3 mb-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-gray-900">{entry.day}</Text>
        <Text className="text-sm text-gray-500">{entry.time}</Text>
      </View>
      <Text className="text-base text-gray-700 mt-1">
        Stiffness {entry.stiffness}/4 • Tremor {entry.tremor}/4
      </Text>
      <Text className="text-sm text-gray-500 mt-1">
        Level was {entry.level} ng/mL
      </Text>
    </View>
  );
}
