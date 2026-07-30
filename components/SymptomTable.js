import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";
import { SLEEP_OPTIONS, SYMPTOMS, sleepLabel } from "../data/symptoms";

// The check-in log as a table rather than a stack of paragraphs, so scores line
// up in columns and can be scanned down. Who recorded each row is a marker in
// its own first column, which keeps it out of the reading order of the numbers.
const REPORTER_STYLE = {
  patient: { colour: "#0e7490", icon: "person", label: "Patient" },
  caregiver: { colour: "#7c3aed", icon: "people", label: "Caregiver" },
};

// Real words, not three-letter stubs. "Sti" and "Spe" mean nothing at a glance,
// and the table scrolls sideways anyway, so the width is affordable.
const SHORT = {
  stiffness: "Stiffness",
  tremor: "Tremor",
  fatigue: "Fatigue",
  pain: "Pain",
  cognition: "Thinking",
  speech: "Speech",
  digestion: "Digestion",
};

const TIME_W = 88;
const CELL_W = 82;
const SLEEP_W = 66;

export default function SymptomTable({ entries, scale = 1 }) {
  if (!entries.length) {
    return (
      <Text style={{ fontSize: 16 * scale, color: "#64748b" }}>
        No check-ins yet.
      </Text>
    );
  }

  return (
    <View>
      {/* One line explaining the marker column, rather than a legend block */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 13 * scale, color: "#64748b", marginRight: 4 }}>
          Recorded by
        </Text>
        {Object.entries(REPORTER_STYLE).map(([id, style]) => (
          <View
            key={id}
            style={{ flexDirection: "row", alignItems: "center", marginLeft: 10 }}
          >
            <Ionicons name={style.icon} size={14} color={style.colour} />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 13 * scale,
                fontWeight: "600",
                color: style.colour,
              }}
            >
              {style.label}
            </Text>
          </View>
        ))}
        <Text style={{ fontSize: 13 * scale, color: "#94a3b8", marginLeft: 12 }}>
          0 = none, 4 = severe
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              paddingBottom: 6,
              borderBottomWidth: 2,
              borderBottomColor: "#0f172a",
            }}
          >
            <View style={{ width: 30 }} />
            <Head width={TIME_W} label="Time" align="left" scale={scale} />
            {SYMPTOMS.map((s) => (
              <Head
                key={s.id}
                width={CELL_W}
                label={SHORT[s.id]}
                full={s.label}
                colour={s.colour}
                scale={scale}
              />
            ))}
            <Head width={SLEEP_W} label="Sleep" scale={scale} />
          </View>

          {entries.map((entry) => {
            const style = REPORTER_STYLE[entry.by] || REPORTER_STYLE.patient;
            const sleep = SLEEP_OPTIONS.find((s) => s.id === entry.sleep);

            return (
              <View key={entry.id}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 9,
                    borderBottomWidth: 1,
                    borderBottomColor: "#e5e7eb",
                  }}
                >
                  {/* Who recorded it, as a marker rather than words */}
                  <View
                    style={{ width: 30, flexDirection: "row", alignItems: "center" }}
                    accessibilityLabel={`Recorded by ${style.label}`}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: style.colour,
                      }}
                    />
                    <Ionicons
                      name={style.icon}
                      size={13}
                      color={style.colour}
                      style={{ marginLeft: 3 }}
                    />
                  </View>

                  <Text
                    style={{
                      width: TIME_W,
                      fontSize: 14 * scale,
                      color: "#0f172a",
                      fontWeight: "600",
                    }}
                  >
                    {entry.timeLabel}
                  </Text>

                  {SYMPTOMS.map((s) => {
                    const value = entry.scores?.[s.id] ?? 0;
                    return (
                      <View
                        key={s.id}
                        style={{ width: CELL_W, alignItems: "center" }}
                        accessibilityLabel={`${s.label} ${value} out of 4`}
                      >
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            // Zero is left plain, so the eye lands on what was
                            // actually reported.
                            backgroundColor: value === 0 ? "transparent" : s.colour,
                            opacity: value === 0 ? 1 : 0.25 + value * 0.19,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14 * scale,
                              fontWeight: value === 0 ? "400" : "700",
                              color: value === 0 ? "#94a3b8" : "#0f172a",
                            }}
                          >
                            {value}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  <View style={{ width: SLEEP_W, alignItems: "center" }}>
                    {sleep ? (
                      <Ionicons
                        name={sleep.icon}
                        size={20}
                        color={sleep.colour}
                        accessibilityLabel={sleepLabel(entry.sleep)}
                      />
                    ) : (
                      <Text style={{ fontSize: 14 * scale, color: "#cbd5e1" }}>–</Text>
                    )}
                  </View>
                </View>

                {/* A free-text note gets its own full-width line under the row */}
                {entry.note ? (
                  <View
                    style={{
                      paddingLeft: 30,
                      paddingVertical: 7,
                      borderBottomWidth: 1,
                      borderBottomColor: "#e5e7eb",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15 * scale,
                        fontStyle: "italic",
                        color: "#475569",
                      }}
                    >
                      “{entry.note}”
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function Head({ width, label, full, colour, align, scale }) {
  return (
    <Text
      accessibilityLabel={full || label}
      style={{
        width,
        textAlign: align === "left" ? "left" : "center",
        fontSize: 12 * scale,
        fontWeight: "700",
        letterSpacing: 0.3,
        color: colour || "#64748b",
      }}
    >
      {label}
    </Text>
  );
}
