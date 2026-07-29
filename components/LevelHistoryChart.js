import { ScrollView, Text, View } from "react-native";
import { levelTone } from "../data/history";

const MAX = 2000; // ng/mL at the top of the chart
const HEIGHT = 180; // tallest a bar can be, in pixels

// Scrolls sideways through the day. Each bar is coloured by its level band.
export default function LevelHistoryChart({ data }) {
  return (
    <ScrollView horizontal contentContainerStyle={{ alignItems: "flex-end" }}>
      {data.map((reading) => {
        const tone = levelTone(reading.level);
        return (
          <View key={reading.label} className="items-center mx-1.5" style={{ width: 36 }}>
            <Text className="text-xs font-medium text-gray-800 mb-1">{reading.level}</Text>
            <View
              style={{
                height: (reading.level / MAX) * HEIGHT,
                width: 22,
                borderRadius: 6,
                backgroundColor: tone.color,
              }}
            />
            <Text className="text-xs text-gray-600 mt-2">{reading.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function ChartLegend() {
  const bands = [
    { color: "#2563eb", label: "Low (under 500)" },
    { color: "#16a34a", label: "In range (500–1500)" },
    { color: "#dc2626", label: "High (over 1500)" },
  ];
  return (
    <View className="flex-row flex-wrap mt-4">
      {bands.map((band) => (
        <View key={band.label} className="flex-row items-center mr-4 mb-2">
          <View
            style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: band.color }}
          />
          <Text className="text-base text-gray-700 ml-2">{band.label}</Text>
        </View>
      ))}
    </View>
  );
}
