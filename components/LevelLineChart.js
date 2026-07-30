import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { CHART_MAX, RANGE_HIGH, RANGE_LOW, levelTone } from "../data/history";

const HEIGHT = 220; // whole chart, in pixels
const PAD_TOP = 14;
const PAD_BOTTOM = 26; // room for the day labels
const STEP = 34; // horizontal pixels per reading
const TICKS = [0, 500, 1000, 1500, 2000];

// Turns a ng/mL level into a y pixel inside the plot area.
function yFor(level) {
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  return PAD_TOP + (1 - level / CHART_MAX) * plotHeight;
}

// Line chart with the therapeutic window shaded behind it. Scrolls sideways
// through the full history; tapping a dot selects that reading.
export default function LevelLineChart({ data, selectedId, onSelect }) {
  const width = data.length * STEP;
  const points = data.map((r, i) => `${i * STEP + STEP / 2},${yFor(r.level)}`).join(" ");

  // First reading of each day, so we can draw a divider and a label there.
  const dayStarts = data
    .map((r, i) => ({ ...r, i }))
    .filter((r, i) => i === 0 || data[i - 1].day !== r.day);

  return (
    <View className="flex-row">
      {/* Fixed y-axis so the scale stays visible while scrolling */}
      <View style={{ width: 40, height: HEIGHT }}>
        {TICKS.map((tick) => (
          <Text
            key={tick}
            className="text-xs text-gray-500"
            style={{ position: "absolute", right: 4, top: yFor(tick) - 8 }}
          >
            {tick}
          </Text>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={HEIGHT}>
          {/* Therapeutic window */}
          <Rect
            x="0"
            y={yFor(RANGE_HIGH)}
            width={width}
            height={yFor(RANGE_LOW) - yFor(RANGE_HIGH)}
            fill="#dcfce7"
          />

          {/* Gridlines */}
          {TICKS.map((tick) => (
            <Line
              key={tick}
              x1="0"
              y1={yFor(tick)}
              x2={width}
              y2={yFor(tick)}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Day dividers */}
          {dayStarts.slice(1).map((d) => (
            <Line
              key={d.day}
              x1={d.i * STEP}
              y1={PAD_TOP}
              x2={d.i * STEP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          <Polyline points={points} fill="none" stroke="#4ade80" strokeWidth="2.5" />

          {data.map((reading, i) => {
            const tone = levelTone(reading.level);
            const selected = reading.id === selectedId;
            const cx = i * STEP + STEP / 2;
            return (
              <Circle
                key={reading.id}
                cx={cx}
                cy={yFor(reading.level)}
                r={selected ? 8 : 5}
                fill={tone.color}
                stroke="#ffffff"
                strokeWidth={selected ? 3 : 1.5}
                onPress={() => onSelect(reading)}
              />
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

// Day labels under the chart, and the scroll hint.
export function ChartFooter({ days }) {
  return (
    <View className="mt-2">
      <View className="flex-row flex-wrap">
        {days.map((day) => (
          <Text key={day} className="text-sm font-medium text-gray-700 mr-5">
            {day}
          </Text>
        ))}
      </View>
      <Text className="text-sm text-gray-500 mt-2 text-center">
        Tap a dot to inspect • Scroll to see full history
      </Text>
    </View>
  );
}

export function ChartLegend() {
  const items = [
    { color: "#16a34a", label: "In range" },
    { color: "#dc2626", label: "High" },
    { color: "#2563eb", label: "Low" },
  ];
  return (
    <View className="flex-row flex-wrap items-center mb-3">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center mr-4 mb-1">
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: item.color,
            }}
          />
          <Text className="text-sm text-gray-700 ml-1.5">{item.label}</Text>
        </View>
      ))}
      <View className="flex-row items-center mb-1">
        <View
          style={{ width: 22, height: 12, borderRadius: 3, backgroundColor: "#dcfce7" }}
        />
        <Text className="text-sm text-gray-700 ml-1.5">Target</Text>
      </View>
    </View>
  );
}
