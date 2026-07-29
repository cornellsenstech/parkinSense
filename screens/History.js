import { useContext } from "react";
import { ScrollView, Text, View } from "react-native";
import Card from "../components/Card";
import LevelHistoryChart, { ChartLegend } from "../components/LevelHistoryChart";
import { getHistory } from "../data/history";
import { RoleContext } from "../context/RoleContext";

export default function History() {
  const { user } = useContext(RoleContext);
  const data = getHistory(user);

  const total = data.reduce((sum, reading) => sum + reading.level, 0);
  const average = Math.round(total / data.length);
  const peak = Math.max(...data.map((reading) => reading.level));

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
    >
      <Text className="text-5xl font-black text-gray-900 mb-1">History</Text>
      <Text className="text-lg text-gray-600 mb-6">
        Last 24 hours • average {average} ng/mL • peak {peak} ng/mL
      </Text>

      <Card title="Levels over time" subtitle="Scroll sideways to see the full day">
        <LevelHistoryChart data={data} />
        <ChartLegend />
      </Card>
    </ScrollView>
  );
}
