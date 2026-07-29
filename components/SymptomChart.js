import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

const HEIGHT = 170;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const STEP = 52; // wider than the level chart — far fewer check-ins
const MAX = 4; // symptom scale is 0-4
const TICKS = [0, 1, 2, 3, 4];

const STIFFNESS = "#7c3aed";
const TREMOR = "#ea580c";

function yFor(value) {
  const plot = HEIGHT - PAD_TOP - PAD_BOTTOM;
  return PAD_TOP + (1 - value / MAX) * plot;
}

// Stiffness and tremor over time on the shared 0-4 scale. Two lines rather
// than two charts, so the patient can see whether they move together.
export default function SymptomChart({ entries }) {
  const width = Math.max(entries.length * STEP, 1);
  const line = (key) =>
    entries.map((e, i) => `${i * STEP + STEP / 2},${yFor(e[key])}`).join(" ");

  return (
    <View>
      <View className="flex-row flex-wrap items-center mb-3">
        <Key color={STIFFNESS} label="Stiffness" />
        <Key color={TREMOR} label="Tremor" />
        <Text className="text-sm text-gray-500 mb-1">0 = none, 4 = severe</Text>
      </View>

      <View className="flex-row">
        {/* Fixed y-axis */}
        <View style={{ width: 22, height: HEIGHT }}>
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
          <View>
            <Svg width={width} height={HEIGHT}>
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

              <Polyline points={line("stiffness")} fill="none" stroke={STIFFNESS} strokeWidth="2.5" />
              <Polyline points={line("tremor")} fill="none" stroke={TREMOR} strokeWidth="2.5" />

              {entries.map((entry, i) => (
                <Circle
                  key={`st-${entry.id}`}
                  cx={i * STEP + STEP / 2}
                  cy={yFor(entry.stiffness)}
                  r="4.5"
                  fill={STIFFNESS}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ))}
              {entries.map((entry, i) => (
                <Circle
                  key={`tr-${entry.id}`}
                  cx={i * STEP + STEP / 2}
                  cy={yFor(entry.tremor)}
                  r="4.5"
                  fill={TREMOR}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ))}
            </Svg>

            {/* Time labels line up with the dots above */}
            <View className="flex-row">
              {entries.map((entry) => (
                <Text
                  key={entry.id}
                  className="text-xs text-gray-500 text-center"
                  style={{ width: STEP }}
                >
                  {entry.time.replace(":00", "")}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function Key({ color, label }) {
  return (
    <View className="flex-row items-center mr-4 mb-1">
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text className="text-sm text-gray-700 ml-1.5">{label}</Text>
    </View>
  );
}
