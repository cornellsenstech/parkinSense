import { useContext, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import LevelLineChart, {
  ChartFooter,
  ChartLegend,
} from "../components/LevelLineChart";
import {
  RANGE_HIGH,
  RANGE_LOW,
  getHistory,
  getSymptomLog,
  levelTone,
} from "../data/history";
import { RoleContext } from "../context/RoleContext";

export default function History() {
  const { user } = useContext(RoleContext);
  const readings = getHistory(user);
  const symptoms = getSymptomLog(user);

  const [view, setView] = useState("Concentration");
  const [selected, setSelected] = useState(readings[readings.length - 1]);

  const total = readings.reduce((sum, r) => sum + r.level, 0);
  const average = Math.round(total / readings.length);
  const inRange = readings.filter(
    (r) => r.level >= RANGE_LOW && r.level <= RANGE_HIGH
  ).length;
  const percentInRange = Math.round((inRange / readings.length) * 100);

  const days = [...new Set(readings.map((r) => r.day))];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
    >
      <Text className="text-4xl font-bold text-gray-900">History</Text>
      <Text className="text-4xl font-black text-gray-900 mb-5">Overview</Text>

      {/* Chart */}
      <View className="bg-white rounded-3xl border border-gray-200 p-5 mb-5">
        <ChartLegend />

        {selected ? (
          <View className="self-center border-2 border-red-300 rounded-2xl px-5 py-3 mb-3 bg-white">
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
      </View>

      {/* Which list to show */}
      <View className="flex-row bg-white rounded-xl border border-gray-200 p-1 mb-4">
        {["Concentration", "Symptoms"].map((option) => {
          const active = option === view;
          return (
            <Pressable
              key={option}
              onPress={() => setView(option)}
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

      {/* Summary */}
      <View className="flex-row bg-white rounded-2xl border border-gray-200 mb-5">
        <Stat value={average} label="Avg ng/mL" />
        <Stat value={`${percentInRange}%`} label="Time in range" divider />
        <Stat value={readings.length} label="Readings" divider />
      </View>

      {/* The list itself */}
      {view === "Concentration"
        ? days
            .slice()
            .reverse()
            .map((day) => (
              <View key={day}>
                <Text className="text-base font-semibold text-gray-700 mb-2 mt-1">
                  {day}
                </Text>
                {readings
                  .filter((r) => r.day === day)
                  .slice()
                  .reverse()
                  .map((reading) => (
                    <ReadingRow key={reading.id} reading={reading} />
                  ))}
              </View>
            ))
        : symptoms.map((entry) => <SymptomRow key={entry.id} entry={entry} />)}
    </ScrollView>
  );
}

function Stat({ value, label, divider }) {
  return (
    <View
      className={`flex-1 items-center py-4 ${divider ? "border-l border-gray-200" : ""}`}
    >
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-sm text-gray-500 mt-0.5">{label}</Text>
    </View>
  );
}

function ReadingRow({ reading }) {
  const tone = levelTone(reading.level);
  return (
    <View className="bg-white rounded-2xl border border-gray-200 px-4 py-3 mb-2">
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
    </View>
  );
}
