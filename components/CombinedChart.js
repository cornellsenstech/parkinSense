import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { CHART_MAX, RANGE_HIGH, RANGE_LOW } from "../data/history";

// Levels and reported symptoms on one time axis.
//
// This pairing is the clinically interesting part — symptoms rising as the level
// leaves the therapeutic window — and it cannot be read from two charts stacked
// on top of each other. Two y scales: ng/mL on the left, the 0-4 symptom score
// on the right.
const HEIGHT = 260;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const STEP = 34;
const AXIS = 44;

const LEVEL_TICKS = [0, 500, 1000, 1500, 2000];
const SYMPTOM_TICKS = [0, 1, 2, 3, 4];
const SYMPTOM_MAX = 4;

const LEVEL_LINE = "#16a34a";
const STIFFNESS = "#7c3aed";
const TREMOR = "#ea580c";

function plotHeight() {
  return HEIGHT - PAD_TOP - PAD_BOTTOM;
}

function yLevel(value) {
  return PAD_TOP + (1 - value / CHART_MAX) * plotHeight();
}

function ySymptom(value) {
  return PAD_TOP + (1 - value / SYMPTOM_MAX) * plotHeight();
}

export default function CombinedChart({ readings, symptoms }) {
  const width = readings.length * STEP;

  const levelLine = readings
    .map((r, i) => `${i * STEP + STEP / 2},${yLevel(r.level)}`)
    .join(" ");

  // Symptom entries are recorded less often than readings, so place each one at
  // the x position of the reading it was taken alongside.
  const indexFor = new Map();
  readings.forEach((r, i) => indexFor.set(`${r.day}|${r.time}`, i));
  const points = symptoms
    .map((s) => ({ ...s, i: indexFor.get(`${s.day}|${s.time}`) }))
    .filter((s) => s.i !== undefined);

  const symptomLine = (key) =>
    points.map((s) => `${s.i * STEP + STEP / 2},${ySymptom(s[key])}`).join(" ");

  const dayStarts = readings
    .map((r, i) => ({ ...r, i }))
    .filter((r, i) => i > 0 && readings[i - 1].day !== r.day);

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
        <Key color={LEVEL_LINE} label="Level (ng/mL)" />
        <Key color={STIFFNESS} label="Stiffness (0–4)" />
        <Key color={TREMOR} label="Tremor (0–4)" />
        <Key color="#dcfce7" label="Target window" block />
      </View>

      <View style={{ flexDirection: "row" }}>
        {/* Left axis: concentration */}
        <View style={{ width: AXIS, height: HEIGHT }}>
          {LEVEL_TICKS.map((tick) => (
            <Text
              key={tick}
              style={{
                position: "absolute",
                right: 5,
                top: yLevel(tick) - 7,
                fontSize: 11,
                color: "#475569",
              }}
            >
              {tick}
            </Text>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <Svg width={width} height={HEIGHT}>
              <Rect
                x="0"
                y={yLevel(RANGE_HIGH)}
                width={width}
                height={yLevel(RANGE_LOW) - yLevel(RANGE_HIGH)}
                fill="#dcfce7"
              />

              {LEVEL_TICKS.map((tick) => (
                <Line
                  key={tick}
                  x1="0"
                  y1={yLevel(tick)}
                  x2={width}
                  y2={yLevel(tick)}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
              ))}

              {dayStarts.map((d) => (
                <Line
                  key={d.day}
                  x1={d.i * STEP}
                  y1={PAD_TOP}
                  x2={d.i * STEP}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}

              <Polyline
                points={levelLine}
                fill="none"
                stroke={LEVEL_LINE}
                strokeWidth="2.5"
              />

              {/* Symptoms drawn dashed, so two scales on one chart stay
                  distinguishable rather than reading as three equal series. */}
              <Polyline
                points={symptomLine("stiffness")}
                fill="none"
                stroke={STIFFNESS}
                strokeWidth="2"
                strokeDasharray="5 4"
              />
              <Polyline
                points={symptomLine("tremor")}
                fill="none"
                stroke={TREMOR}
                strokeWidth="2"
                strokeDasharray="5 4"
              />

              {points.map((s) => (
                <Circle
                  key={`st-${s.id}`}
                  cx={s.i * STEP + STEP / 2}
                  cy={ySymptom(s.stiffness)}
                  r="4"
                  fill={STIFFNESS}
                />
              ))}
              {points.map((s) => (
                <Circle
                  key={`tr-${s.id}`}
                  cx={s.i * STEP + STEP / 2}
                  cy={ySymptom(s.tremor)}
                  r="4"
                  fill={TREMOR}
                />
              ))}
            </Svg>

            {/* Hour labels, thinned out so they do not collide */}
            <View style={{ flexDirection: "row" }}>
              {readings.map((r, i) => (
                <Text
                  key={r.id}
                  style={{
                    width: STEP,
                    textAlign: "center",
                    fontSize: 10,
                    color: "#64748b",
                  }}
                >
                  {i % 3 === 0 ? r.time.replace(":00", "") : ""}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Right axis: symptom score */}
        <View style={{ width: 26, height: HEIGHT }}>
          {SYMPTOM_TICKS.map((tick) => (
            <Text
              key={tick}
              style={{
                position: "absolute",
                left: 6,
                top: ySymptom(tick) - 7,
                fontSize: 11,
                color: "#475569",
              }}
            >
              {tick}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function Key({ color, label, block }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginRight: 14, marginBottom: 4 }}
    >
      <View
        style={{
          width: block ? 18 : 12,
          height: block ? 12 : 12,
          borderRadius: block ? 3 : 6,
          backgroundColor: color,
        }}
      />
      <Text style={{ marginLeft: 6, fontSize: 12, color: "#475569" }}>{label}</Text>
    </View>
  );
}
