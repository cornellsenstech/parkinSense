import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { CHART_MAX, RANGE_HIGH, RANGE_LOW, levelTone } from "../data/history";

const HEIGHT = 150;
const PAD = 12;

// Compact chart of midnight -> now. Always 24 segments, so it fills the card
// width whatever the time of day. Measures its own width via onLayout because
// a percentage width would distort the stroke.
export default function TodayTrend({ points }) {
  const [width, setWidth] = useState(0);

  const y = (level) => PAD + (1 - level / CHART_MAX) * (HEIGHT - PAD * 2);
  const x = (i) => PAD + (i / (points.length - 1)) * (width - PAD * 2);

  const line = points.map((p, i) => `${x(i)},${y(p.level)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {/* Therapeutic window */}
            <Rect
              x="0"
              y={y(RANGE_HIGH)}
              width={width}
              height={y(RANGE_LOW) - y(RANGE_HIGH)}
              fill="#dcfce7"
            />
            <Line
              x1="0"
              y1={y(RANGE_LOW)}
              x2={width}
              y2={y(RANGE_LOW)}
              stroke="#d1d5db"
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1={y(RANGE_HIGH)}
              x2={width}
              y2={y(RANGE_HIGH)}
              stroke="#d1d5db"
              strokeWidth="1"
            />

            <Polyline points={line} fill="none" stroke="#4ade80" strokeWidth="3" />

            {/* Emphasise where the patient is right now */}
            <Circle
              cx={x(points.length - 1)}
              cy={y(last.level)}
              r="7"
              fill={levelTone(last.level).color}
              stroke="#ffffff"
              strokeWidth="2.5"
            />
          </Svg>
        ) : null}
      </View>

      <View className="flex-row justify-between mt-1">
        <Text className="text-sm text-gray-500">12:00 AM</Text>
        <Text className="text-sm font-medium text-gray-700">Now • {last.label}</Text>
      </View>
    </View>
  );
}
