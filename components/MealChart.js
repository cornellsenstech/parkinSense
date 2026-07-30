import { Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { DOSE_HOURS } from "../data/history";
import { doseProximity } from "../data/mealLog";

// Protein through the day, as a bar per meal placed at the hour it was eaten.
//
// Time is the x axis rather than meal order, because that is the whole point: a
// high-protein meal matters when it lands near a dose and much less otherwise.
// Dose times are drawn as vertical markers so the clash is visible directly.
const HEIGHT = 150;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
const AXIS = 30;
const HOURS = 24;

const PROTEIN_VALUE = { low: 1, some: 2, high: 3, unsure: 1 };
const PROTEIN_COLOUR = {
  low: "#cbd5e1",
  some: "#fbbf24",
  high: "#dc2626",
  unsure: "#94a3b8",
};

const TICK_HOURS = [0, 6, 12, 18, 24];

export default function MealChart({ meals, width = 320, scale = 1 }) {
  const plotW = Math.max(width - AXIS, 160);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (minuteOfDay) => AXIS + (minuteOfDay / (HOURS * 60)) * plotW;
  const barHeight = (protein) => ((PROTEIN_VALUE[protein] ?? 1) / 3) * plotH;

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        <Key colour={PROTEIN_COLOUR.high} label="A lot of protein" scale={scale} />
        <Key colour={PROTEIN_COLOUR.some} label="Some" scale={scale} />
        <Key colour={PROTEIN_COLOUR.low} label="Little or none" scale={scale} />
        <Key colour="#0f172a" label="Dose times" scale={scale} dashed />
      </View>

      <Svg width={width} height={HEIGHT}>
        {/* Dose markers first, so bars read against them */}
        {DOSE_HOURS.map((hour) => (
          <Line
            key={hour}
            x1={x(hour * 60)}
            y1={PAD_TOP}
            x2={x(hour * 60)}
            y2={HEIGHT - PAD_BOTTOM}
            stroke="#0f172a"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.5"
          />
        ))}

        <Line
          x1={AXIS}
          y1={HEIGHT - PAD_BOTTOM}
          x2={AXIS + plotW}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {meals.map((meal) => {
          const h = barHeight(meal.protein);
          const flagged = doseProximity(meal)?.flag;
          return (
            <Rect
              key={meal.id}
              x={x(meal.minuteOfDay ?? 0) - 4}
              y={HEIGHT - PAD_BOTTOM - h}
              width="8"
              height={h}
              rx="2"
              fill={PROTEIN_COLOUR[meal.protein] || "#94a3b8"}
              // A clash gets an outline, so it stands out without inventing a
              // fourth colour.
              stroke={flagged ? "#0f172a" : "none"}
              strokeWidth={flagged ? 1.5 : 0}
            />
          );
        })}
      </Svg>

      {/* Hour labels */}
      <View style={{ flexDirection: "row", marginLeft: AXIS - 12 }}>
        {TICK_HOURS.map((hour) => (
          <Text
            key={hour}
            style={{
              width: plotW / (TICK_HOURS.length - 1),
              fontSize: 11,
              color: "#64748b",
            }}
          >
            {hour === 0 ? "12am" : hour === 12 ? "12pm" : hour === 24 ? "" : `${hour > 12 ? hour - 12 : hour}${hour < 12 ? "am" : "pm"}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Key({ colour, label, scale, dashed }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginRight: 12,
        marginBottom: 4,
      }}
    >
      {dashed ? (
        <View
          style={{
            width: 14,
            height: 0,
            borderTopWidth: 2,
            borderStyle: "dashed",
            borderColor: colour,
          }}
        />
      ) : (
        <View
          style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colour }}
        />
      )}
      <Text style={{ marginLeft: 5, fontSize: 13 * scale, color: "#475569" }}>
        {label}
      </Text>
    </View>
  );
}
