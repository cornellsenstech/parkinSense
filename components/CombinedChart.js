import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { CHART_MAX, RANGE_HIGH, RANGE_LOW } from "../data/history";
import { SYMPTOMS } from "../data/symptoms";

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

// Protein load, drawn as a bar rising from the baseline at the hour the meal was
// eaten. Kept visually distinct from the two line series so three kinds of data
// on one time axis stay separable.
const PROTEIN_HEIGHT = { low: 8, some: 20, high: 34, unsure: 12 };
const PROTEIN_COLOUR = {
  low: "#cbd5e1",
  some: "#fbbf24",
  high: "#dc2626",
  unsure: "#94a3b8",
};

export default function CombinedChart({
  readings,
  symptoms,
  meals = [],
  checkIns = [],
}) {
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

  // Real check-ins, placed at the reading nearest the hour they were saved, so
  // every reported symptom can be drawn on the same axis as the levels.
  const reported = checkIns
    .map((entry) => {
      let best = -1;
      let bestGap = Infinity;
      readings.forEach((r, i) => {
        const gap = Math.abs((r.hour ?? 0) - (entry.hour ?? 0));
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      return best >= 0 && bestGap <= 1 ? { entry, i: best } : null;
    })
    .filter(Boolean);

  const reportedLine = (symptomId) =>
    reported
      .map(({ entry, i }) =>
        `${i * STEP + STEP / 2},${ySymptom(entry.scores?.[symptomId] ?? 0)}`
      )
      .join(" ");

  const dayStarts = readings
    .map((r, i) => ({ ...r, i }))
    .filter((r, i) => i > 0 && readings[i - 1].day !== r.day);

  // Place each meal at the reading nearest its hour. Meals are logged against a
  // clock time, not a reading, so they need mapping onto the same axis.
  const mealBars = meals
    .map((meal) => {
      let best = -1;
      let bestGap = Infinity;
      readings.forEach((r, i) => {
        const gap = Math.abs((r.hour ?? 0) - (meal.hour ?? 0));
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      return best >= 0 && bestGap <= 1 ? { meal, i: best } : null;
    })
    .filter(Boolean);

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
        <Key color={LEVEL_LINE} label="Level (ng/mL)" />
        <Key color={STIFFNESS} label="Stiffness (0–4)" />
        <Key color={TREMOR} label="Tremor (0–4)" />
        <Key color="#dcfce7" label="Target window" block />
        <Key color="#dc2626" label="High-protein meal" block />
        <Key color="#fbbf24" label="Some protein" block />
        {SYMPTOMS.filter((s) => s.id !== "stiffness" && s.id !== "tremor").map(
          (s) => (
            <Key key={s.id} color={s.colour} label={s.label} />
          )
        )}
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

              {/* Protein bars sit behind the lines, on the baseline */}
              {mealBars.map(({ meal, i }) => {
                const h = PROTEIN_HEIGHT[meal.protein] ?? 12;
                return (
                  <Rect
                    key={meal.id}
                    x={i * STEP + STEP / 2 - 5}
                    y={HEIGHT - PAD_BOTTOM - h}
                    width="10"
                    height={h}
                    rx="2"
                    fill={PROTEIN_COLOUR[meal.protein] || "#94a3b8"}
                    opacity="0.85"
                  />
                );
              })}

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

              {/* Everything the patient or caregiver actually reported, beyond
                  the two motor symptoms the demo curve implies. */}
              {reported.length
                ? SYMPTOMS.filter(
                    (s) => s.id !== "stiffness" && s.id !== "tremor"
                  ).map((symptom) => (
                    <Polyline
                      key={symptom.id}
                      points={reportedLine(symptom.id)}
                      fill="none"
                      stroke={symptom.colour}
                      strokeWidth="1.6"
                      strokeDasharray="2 3"
                      opacity="0.9"
                    />
                  ))
                : null}
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
