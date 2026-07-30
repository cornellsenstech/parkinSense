import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { SYMPTOMS } from "../data/symptoms";

const HEIGHT = 220;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
const STEP = 56;
const MAX = 4;
const TICKS = [0, 1, 2, 3, 4];

// Colour carries the symptom, line style carries who reported it: solid for the
// patient, dashed for the caregiver. Keeping those on separate visual channels
// means seven symptoms and two reporters stay readable at once.
const REPORTERS = [
  { id: "patient", label: "Patient", dash: null },
  { id: "caregiver", label: "Caregiver", dash: "5 4" },
];

function yFor(value) {
  return PAD_TOP + (1 - value / MAX) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
}

export default function SymptomHistoryChart({ entries, scale = 1 }) {
  // Start with every symptom on, but only the patient's own reports. Showing
  // both reporters at once doubles the lines before anyone has asked for the
  // comparison; the caregiver checkbox turns it on when it is wanted.
  const [shown, setShown] = useState(() => {
    const all = {};
    SYMPTOMS.forEach((s) => {
      all[s.id] = true;
    });
    return all;
  });
  const [reporters, setReporters] = useState({ patient: true, caregiver: false });

  const activeSymptoms = SYMPTOMS.filter((s) => shown[s.id]);
  const activeReporters = REPORTERS.filter((r) => reporters[r.id]);

  // One x position per check-in, oldest first.
  const width = Math.max(entries.length * STEP, STEP);

  function seriesFor(symptomId, reporterId) {
    return entries
      .map((entry, i) => ({ entry, i }))
      .filter(({ entry }) => entry.by === reporterId)
      .map(({ entry, i }) => ({
        x: i * STEP + STEP / 2,
        y: yFor(entry.scores?.[symptomId] ?? 0),
      }));
  }

  return (
    <View>
      {/* Symptom checkboxes */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        {SYMPTOMS.map((symptom) => (
          <CheckChip
            key={symptom.id}
            label={symptom.label}
            colour={symptom.colour}
            checked={Boolean(shown[symptom.id])}
            scale={scale}
            onPress={() =>
              setShown((c) => ({ ...c, [symptom.id]: !c[symptom.id] }))
            }
          />
        ))}
      </View>

      {/* Reporter checkboxes */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginBottom: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
        }}
      >
        {REPORTERS.map((reporter) => (
          <CheckChip
            key={reporter.id}
            label={reporter.label}
            colour="#475569"
            dashed={Boolean(reporter.dash)}
            checked={Boolean(reporters[reporter.id])}
            scale={scale}
            onPress={() =>
              setReporters((c) => ({ ...c, [reporter.id]: !c[reporter.id] }))
            }
          />
        ))}
      </View>

      {entries.length === 0 ? (
        <Text style={{ fontSize: 16 * scale, color: "#64748b", paddingVertical: 12 }}>
          No check-ins saved yet. Anything you record on the Home tab appears here.
        </Text>
      ) : (
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 22, height: HEIGHT }}>
            {TICKS.map((tick) => (
              <Text
                key={tick}
                style={{
                  position: "absolute",
                  right: 4,
                  top: yFor(tick) - 8,
                  fontSize: 11,
                  color: "#64748b",
                }}
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

                {activeSymptoms.map((symptom) =>
                  activeReporters.map((reporter) => {
                    const points = seriesFor(symptom.id, reporter.id);
                    if (!points.length) return null;
                    return (
                      <Polyline
                        key={`${symptom.id}-${reporter.id}`}
                        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={symptom.colour}
                        strokeWidth="2.5"
                        strokeDasharray={reporter.dash || undefined}
                      />
                    );
                  })
                )}

                {activeSymptoms.map((symptom) =>
                  activeReporters.map((reporter) =>
                    seriesFor(symptom.id, reporter.id).map((p, i) => (
                      <Circle
                        key={`${symptom.id}-${reporter.id}-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill={symptom.colour}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    ))
                  )
                )}
              </Svg>

              <View style={{ flexDirection: "row" }}>
                {entries.map((entry) => (
                  <Text
                    key={entry.id}
                    numberOfLines={1}
                    style={{
                      width: STEP,
                      textAlign: "center",
                      fontSize: 10,
                      color: "#64748b",
                    }}
                  >
                    {entry.timeLabel.replace(":00", "")}
                  </Text>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// A checkbox with a colour swatch, so the legend and the control are one thing
// rather than two that can drift apart.
function CheckChip({ label, colour, checked, onPress, scale, dashed }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        paddingHorizontal: 10,
        marginRight: 6,
        marginBottom: 6,
        borderRadius: 10,
        backgroundColor: checked ? "#f1f5f9" : "transparent",
        borderWidth: 1,
        borderColor: checked ? "#cbd5e1" : "#e5e7eb",
      }}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={18}
        color={checked ? colour : "#94a3b8"}
      />
      {dashed ? (
        <View
          style={{
            width: 16,
            height: 0,
            borderTopWidth: 2,
            borderStyle: "dashed",
            borderColor: checked ? colour : "#cbd5e1",
            marginLeft: 6,
          }}
        />
      ) : (
        <View
          style={{
            width: 16,
            height: 2,
            backgroundColor: checked ? colour : "#cbd5e1",
            marginLeft: 6,
          }}
        />
      )}
      <Text
        style={{
          marginLeft: 6,
          fontSize: 14 * scale,
          fontWeight: checked ? "700" : "400",
          color: checked ? "#0f172a" : "#64748b",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
