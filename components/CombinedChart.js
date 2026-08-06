import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";
import { CHART_MAX, rangeFor } from "../data/history";
import { doseKind } from "../data/doseLog";
import { SYMPTOMS } from "../data/symptoms";

// Levels, reported symptoms and protein load on one time axis.
//
// The pairing is the clinical point: symptoms rising as the level leaves the
// therapeutic window. Seven symptom lines at once is unreadable, so the default
// is a single averaged symptom line, with a switch to separate them and a
// dropdown to choose exactly which series are drawn.
const HEIGHT = 260;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const STEP = 34;
const AXIS = 44;

const LEVEL_TICKS = [0, 500, 1000, 1500, 2000];
const SYMPTOM_TICKS = [0, 1, 2, 3, 4];
const SYMPTOM_MAX = 4;

const LEVEL_COLOUR = "#16a34a";
const COMBINED_COLOUR = "#7c3aed";

const PROTEIN_HEIGHT = { low: 8, some: 20, high: 34, unsure: 12 };
const PROTEIN_COLOUR = {
  low: "#cbd5e1",
  some: "#fbbf24",
  high: "#dc2626",
  unsure: "#94a3b8",
};

function plot() {
  return HEIGHT - PAD_TOP - PAD_BOTTOM;
}
function yLevel(value) {
  return PAD_TOP + (1 - value / CHART_MAX) * plot();
}
function ySymptom(value) {
  return PAD_TOP + (1 - value / SYMPTOM_MAX) * plot();
}

// Overall symptom burden for one check-in: the mean of everything scored.
function meanScore(entry) {
  const values = SYMPTOMS.map((s) => entry.scores?.[s.id] ?? 0);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function CombinedChart({
  readings,
  checkIns = [],
  meals = [],
  doses = [],
  patientId,
}) {
  const { low, high } = rangeFor(patientId);
  const [separate, setSeparate] = useState(false);
  const [open, setOpen] = useState(false);
  // Which column the pointer is over. Also set on press, so it works on a
  // touchscreen where there is no hover.
  const [hover, setHover] = useState(null);
  const [showLevel, setShowLevel] = useState(true);
  const [showProtein, setShowProtein] = useState(true);
  const [showDoses, setShowDoses] = useState(true);
  const [shown, setShown] = useState(() => {
    const all = {};
    SYMPTOMS.forEach((s) => {
      all[s.id] = true;
    });
    return all;
  });

  const width = readings.length * STEP;
  const xAt = (i) => i * STEP + STEP / 2;

  // Map a real timestamp onto the reading axis.
  //
  // Matching on hour alone was wrong: the axis spans two days, so hour 8 exists
  // twice and the lookup always found day one. Every day-two entry was drawn
  // back on day one's column and the line doubled back on itself. Positioning by
  // how long ago it happened keeps the series monotonic.
  const lastIndex = readings.length - 1;
  const indexForTime = (timestamp) => {
    if (!timestamp) return -1;
    const hoursAgo = (Date.now() - timestamp) / 3600000;
    const i = Math.round(lastIndex - hoursAgo);
    return i >= 0 && i <= lastIndex ? i : -1;
  };

  // The reading axis covers the recent window only, but the logs go back much
  // further. Without this cutoff, entries from a fortnight ago were matched by
  // hour alone and stacked onto the same columns as today's.
  const spanHours = readings.length;
  const cutoff = Date.now() - spanHours * 60 * 60 * 1000;

  const placedCheckIns = checkIns
    .filter((entry) => entry.savedAt >= cutoff)
    .map((entry) => ({ entry, i: indexForTime(entry.savedAt) }))
    .filter((p) => p.i >= 0)
    .sort((a, b) => a.i - b.i); // left to right, so the line cannot backtrack

  const placedMeals = meals
    .filter((meal) => meal.eatenAt >= cutoff)
    .map((meal) => ({ meal, i: indexForTime(meal.eatenAt) }))
    .filter((p) => p.i >= 0);

  // Doses on the same axis. A missed dose and a normal pre-dose trough look
  // identical on the concentration line alone, which is exactly the ambiguity
  // these markers resolve.
  const placedDoses = doses
    .filter((dose) => dose.takenAt >= cutoff)
    .map((dose) => ({ dose, i: indexForTime(dose.takenAt) }))
    .filter((p) => p.i >= 0);

  const levelLine = readings.map((r, i) => `${xAt(i)},${yLevel(r.level)}`).join(" ");

  const combinedLine = placedCheckIns
    .map(({ entry, i }) => `${xAt(i)},${ySymptom(meanScore(entry))}`)
    .join(" ");

  const symptomLine = (id) =>
    placedCheckIns
      .map(({ entry, i }) => `${xAt(i)},${ySymptom(entry.scores?.[id] ?? 0)}`)
      .join(" ");

  const dayStarts = readings
    .map((r, i) => ({ ...r, i }))
    .filter((r, i) => i > 0 && readings[i - 1].day !== r.day);

  const activeSymptoms = SYMPTOMS.filter((s) => shown[s.id]);

  return (
    <View>
      {/* One row: a Symptoms dropdown on the left, then Concentration and Meals
          as plain checkboxes beside it. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel="Choose which symptoms to show"
          style={{
            flexDirection: "row",
            alignItems: "center",
            minWidth: 200,
            paddingHorizontal: 12,
            paddingVertical: 9,
            marginRight: 16,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: open ? "#0f172a" : "#cbd5e1",
            backgroundColor: "#ffffff",
          }}
        >
          <Text
            style={{ fontSize: 12.5, fontWeight: "700", color: "#0f172a", flex: 1 }}
          >
            Symptoms: {separate ? summarise(activeSymptoms) : "Average"}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={15}
            color="#475569"
            style={{ marginLeft: 8 }}
          />
        </Pressable>

        <Check
          label="Concentration"
          colour={LEVEL_COLOUR}
          checked={showLevel}
          onPress={() => setShowLevel(!showLevel)}
        />
        <Check
          label="Meals"
          colour="#dc2626"
          checked={showProtein}
          onPress={() => setShowProtein(!showProtein)}
        />
        <Check
          label="Doses"
          colour="#166534"
          checked={showDoses}
          onPress={() => setShowDoses(!showDoses)}
        />
      </View>

      {/* Average first, then the individual symptoms under it */}
      {open ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 12,
            marginBottom: 12,
            backgroundColor: "#ffffff",
            overflow: "hidden",
            maxWidth: 320,
          }}
        >
          <Option
            label="Average of all seven"
            colour={COMBINED_COLOUR}
            selected={!separate}
            onPress={() => setSeparate(false)}
          />

          <View style={{ height: 1, backgroundColor: "#e2e8f0" }} />

          {SYMPTOMS.map((s) => (
            <Option
              key={s.id}
              label={s.label}
              colour={s.colour}
              selected={separate && Boolean(shown[s.id])}
              onPress={() => {
                // Picking an individual symptom moves off the average.
                if (!separate) {
                  setSeparate(true);
                  setShown({ ...allSymptoms(false), [s.id]: true });
                } else {
                  setShown((c) => ({ ...c, [s.id]: !c[s.id] }));
                }
              }}
            />
          ))}

          {separate ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                padding: 8,
                borderTopWidth: 1,
                borderTopColor: "#e2e8f0",
                backgroundColor: "#f8fafc",
              }}
            >
              <MiniButton label="All" onPress={() => setShown(allSymptoms(true))} />
              <MiniButton
                label="None"
                onPress={() => setShown(allSymptoms(false))}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Compact legend of what is actually drawn */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        {showLevel ? <Key colour={LEVEL_COLOUR} label="Concentration" /> : null}
        {separate ? (
          activeSymptoms.map((s) => (
            <Key key={s.id} colour={s.colour} label={s.label} dashed />
          ))
        ) : (
          <Key colour={COMBINED_COLOUR} label="All symptoms (average)" dashed />
        )}
        <Key colour="#dcfce7" label="Target window" block />
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
                color: showLevel ? "#475569" : "#cbd5e1",
              }}
            >
              {tick}
            </Text>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ position: "relative" }}>
            <Svg width={width} height={HEIGHT}>
              <Rect
                x="0"
                y={yLevel(high)}
                width={width}
                height={yLevel(low) - yLevel(high)}
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

              {/* Guide line at the hovered column */}
              {hover !== null ? (
                <Line
                  x1={xAt(hover)}
                  y1={PAD_TOP}
                  x2={xAt(hover)}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                  opacity="0.35"
                />
              ) : null}

              {/* Protein sits behind the lines, on the baseline */}
              {showProtein
                ? placedMeals.map(({ meal, i }) => {
                    const h = PROTEIN_HEIGHT[meal.protein] ?? 12;
                    return (
                      <Rect
                        key={meal.id}
                        x={xAt(i) - 5}
                        y={HEIGHT - PAD_BOTTOM - h}
                        width="10"
                        height={h}
                        rx="2"
                        fill={PROTEIN_COLOUR[meal.protein] || "#94a3b8"}
                        opacity="0.85"
                      />
                    );
                  })
                : null}

              {/* Dose markers ride along the top of the plot, clear of the
                  protein bars on the baseline. A missed dose gets a hollow
                  marker so it reads as an absence rather than an event. */}
              {showDoses
                ? placedDoses.map(({ dose, i }) => {
                    const kind = doseKind(dose.kind);
                    const missed = dose.kind === "missed";
                    return (
                      <Circle
                        key={dose.id}
                        cx={xAt(i)}
                        cy={PAD_TOP + 7}
                        r="5"
                        fill={missed ? "#ffffff" : kind.colour}
                        stroke={kind.colour}
                        strokeWidth="2"
                      />
                    );
                  })
                : null}

              {showLevel ? (
                <Polyline
                  points={levelLine}
                  fill="none"
                  stroke={LEVEL_COLOUR}
                  strokeWidth="2.5"
                />
              ) : null}

              {/* Symptoms dashed, so two scales on one chart stay separable */}
              {separate
                ? activeSymptoms.map((s) => (
                    <Polyline
                      key={s.id}
                      points={symptomLine(s.id)}
                      fill="none"
                      stroke={s.colour}
                      strokeWidth="2"
                      strokeDasharray="5 4"
                    />
                  ))
                : combinedLine ? (
                    <Polyline
                      points={combinedLine}
                      fill="none"
                      stroke={COMBINED_COLOUR}
                      strokeWidth="2.5"
                      strokeDasharray="5 4"
                    />
                  ) : null}

              {!separate
                ? placedCheckIns.map(({ entry, i }) => (
                    <Circle
                      key={entry.id}
                      cx={xAt(i)}
                      cy={ySymptom(meanScore(entry))}
                      r="4"
                      fill={COMBINED_COLOUR}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  ))
                : null}
            </Svg>

            {/* One invisible hover target per reading, sitting over the chart */}
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width,
                height: HEIGHT,
                flexDirection: "row",
              }}
            >
              {readings.map((r, i) => (
                <Pressable
                  key={r.id}
                  onHoverIn={() => setHover(i)}
                  onHoverOut={() => setHover(null)}
                  onPress={() => setHover(hover === i ? null : i)}
                  accessibilityLabel={`${r.time}, ${r.level} ng/mL`}
                  style={{ width: STEP, height: HEIGHT }}
                />
              ))}
            </View>

            {hover !== null ? (
              <Tooltip
                reading={readings[hover]}
                index={hover}
                total={readings.length}
                checkIn={
                  (placedCheckIns.find((p) => p.i === hover) || {}).entry || null
                }
                meal={(placedMeals.find((p) => p.i === hover) || {}).meal || null}
                dose={(placedDoses.find((p) => p.i === hover) || {}).dose || null}
                separate={separate}
                activeSymptoms={activeSymptoms}
                low={low}
                high={high}
              />
            ) : null}
            </View>

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

      {placedCheckIns.length === 0 ? (
        <Text style={{ fontSize: 12.5, color: "#64748b", marginTop: 8 }}>
          No symptom check-ins recorded in this period.
        </Text>
      ) : null}
    </View>
  );
}

// Details for the hovered column. Flips to the left of the pointer in the last
// third of the chart so it never runs off the edge.
function Tooltip({
  reading,
  index,
  total,
  checkIn,
  meal,
  dose,
  separate,
  activeSymptoms,
  low,
  high,
}) {
  const flip = index > total * 0.66;
  const x = index * STEP + STEP / 2;
  // The band is judged against this patient's own window, which is passed in
  // rather than read from a module constant — the two are not the same number.
  const band =
    reading.level < low
      ? "Low"
      : reading.level > high
      ? "High"
      : "In range";

  const scored = checkIn
    ? (separate ? activeSymptoms : SYMPTOMS).filter(
        (s) => (checkIn.scores?.[s.id] ?? 0) > 0
      )
    : [];

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 10,
        left: flip ? undefined : x + 10,
        right: flip ? total * STEP - x + 10 : undefined,
        minWidth: 170,
        maxWidth: 230,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRadius: 10,
        padding: 10,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#64748b" }}>
        {reading.day} · {reading.time}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#0f172a" }}>
          {reading.level}
        </Text>
        <Text style={{ fontSize: 11, color: "#64748b", marginLeft: 4 }}>
          ng/mL · {band}
        </Text>
      </View>

      {dose ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
          }}
        >
          <Ionicons
            name={doseKind(dose.kind).icon}
            size={14}
            color={doseKind(dose.kind).colour}
          />
          <Text
            style={{
              fontSize: 12,
              color: doseKind(dose.kind).colour,
              fontWeight: "700",
              marginLeft: 5,
            }}
          >
            Dose {doseKind(dose.kind).short.toLowerCase()} · {dose.timeLabel}
          </Text>
        </View>
      ) : null}

      {checkIn ? (
        <View
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b" }}>
            {checkIn.by === "caregiver" ? "Caregiver report" : "Patient report"}
          </Text>
          {scored.length ? (
            scored.map((s) => (
              <Text key={s.id} style={{ fontSize: 12, color: "#0f172a" }}>
                {s.label} {checkIn.scores[s.id]}/4
              </Text>
            ))
          ) : (
            <Text style={{ fontSize: 12, color: "#64748b" }}>
              Nothing troubling reported
            </Text>
          )}
          {checkIn.note ? (
            <Text
              style={{
                fontSize: 12,
                fontStyle: "italic",
                color: "#475569",
                marginTop: 4,
              }}
            >
              “{checkIn.note}”
            </Text>
          ) : null}
        </View>
      ) : null}

      {meal ? (
        <View
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b" }}>
            Meal
          </Text>
          <Text style={{ fontSize: 12, color: "#0f172a" }}>
            {meal.food ? `${meal.food} · ` : ""}
            {PROTEIN_WORD[meal.protein] || meal.protein}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const PROTEIN_WORD = {
  low: "little or no protein",
  some: "some protein",
  high: "a lot of protein",
  unsure: "protein not recorded",
};

function allSymptoms(value) {
  const next = {};
  SYMPTOMS.forEach((s) => {
    next[s.id] = value;
  });
  return next;
}

// What the dropdown button says when individual symptoms are picked.
function summarise(active) {
  if (!active.length) return "none";
  if (active.length === SYMPTOMS.length) return "all seven";
  if (active.length === 1) return active[0].label.toLowerCase();
  return `${active.length} selected`;
}

// A row in the dropdown: colour swatch, label, tick when chosen.
function Option({ label, colour, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 42,
        paddingHorizontal: 12,
        backgroundColor: selected ? "#f1f5f9" : "transparent",
      }}
    >
      <View
        style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: colour }}
      />
      <Text
        style={{
          flex: 1,
          marginLeft: 10,
          fontSize: 13,
          fontWeight: selected ? "700" : "400",
          color: selected ? "#0f172a" : "#475569",
        }}
      >
        {label}
      </Text>
      {selected ? (
        <Ionicons name="checkmark" size={16} color="#0f172a" />
      ) : null}
    </Pressable>
  );
}

function MiniButton({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${label}`}
      style={{
        paddingHorizontal: 9,
        paddingVertical: 4,
        marginLeft: 6,
        borderRadius: 7,
        backgroundColor: "#e2e8f0",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#475569" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Check({ label, colour, checked, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingRight: 14,
      }}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={17}
        color={checked ? colour : "#94a3b8"}
      />
      <Text
        style={{
          marginLeft: 6,
          fontSize: 12.5,
          fontWeight: checked ? "700" : "400",
          color: checked ? "#0f172a" : "#64748b",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Key({ colour, label, block, dashed }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginRight: 14,
        marginBottom: 4,
      }}
    >
      {block ? (
        <View
          style={{ width: 18, height: 11, borderRadius: 3, backgroundColor: colour }}
        />
      ) : dashed ? (
        <View
          style={{
            width: 18,
            height: 0,
            borderTopWidth: 2,
            borderStyle: "dashed",
            borderColor: colour,
          }}
        />
      ) : (
        <View style={{ width: 18, height: 2.5, backgroundColor: colour }} />
      )}
      <Text style={{ marginLeft: 6, fontSize: 12, color: "#475569" }}>{label}</Text>
    </View>
  );
}
