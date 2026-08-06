import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { AccessibilityContext } from "../context/AccessibilityContext";
import { RoleContext } from "../context/RoleContext";
import {
  DOSE_KINDS,
  describeSchedule,
  doseSchedule,
  loadDoses,
  removeDose,
  saveDose,
} from "../data/doseLog";
import { parseTime } from "../data/mealLog";

const UNDO_SECONDS = 20;

// Recording what happened with each dose, and the reminder for the next one.
//
// The reminder is on-screen only. There is no background scheduler on the web,
// so a push notification would fire only when the app happened to be open —
// promising a reminder that cannot be relied on is worse than showing the next
// dose time honestly and letting the patient decide.
export default function DoseCard({ patientId }) {
  const { scale } = useContext(AccessibilityContext);
  const { reporter } = useContext(RoleContext);

  const [doses, setDoses] = useState([]);
  const [pending, setPending] = useState(null); // which kind is being logged
  const [timeText, setTimeText] = useState("");
  const [justSaved, setJustSaved] = useState(null);
  const undoTimer = useRef(null);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  useEffect(() => {
    let active = true;
    loadDoses(patientId).then((list) => {
      if (active) setDoses(list);
    });
    return () => {
      active = false;
    };
  }, [patientId]);

  const schedule = doseSchedule(doses);
  const banner = describeSchedule(schedule);
  const asCaregiver = reporter === "caregiver";

  async function log(kind) {
    const typed = parseTime(timeText);
    const entry = await saveDose(patientId, {
      kind,
      minutesAgo: 0,
      atMinuteOfDay: typed ?? undefined,
      // A rescue dose is unscheduled by definition, so it is never attached to
      // one of the three slots even if it happens to fall near one.
      scheduledHour: kind === "rescue" ? null : undefined,
      by: reporter,
    });
    if (!entry) return;

    setDoses(await loadDoses(patientId));
    setJustSaved(entry);
    setPending(null);
    setTimeText("");
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setJustSaved(null), UNDO_SECONDS * 1000);
  }

  async function handleUndo() {
    if (!justSaved) return;
    clearTimeout(undoTimer.current);
    await removeDose(patientId, justSaved.id);
    setDoses(await loadDoses(patientId));
    setJustSaved(null);
  }

  const tone =
    banner?.tone === "warn"
      ? { bg: "#fee2e2", ink: "#991b1b", icon: "alert-circle" }
      : banner?.tone === "due"
      ? { bg: "#ffedd5", ink: "#9a3412", icon: "time" }
      : banner?.tone === "good"
      ? { bg: "#dcfce7", ink: "#166534", icon: "checkmark-circle" }
      : { bg: "#eaf0f1", ink: "#3d5257", icon: "time-outline" };

  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
      <Text
        style={{
          fontSize: 24 * scale,
          lineHeight: 30 * scale,
          fontWeight: "700",
          color: "#0f172a",
        }}
      >
        Your doses
      </Text>
      <Text style={{ fontSize: 16 * scale, color: "#475569", marginTop: 2 }}>
        {asCaregiver
          ? "Record what they took, so the chart knows."
          : "Record what you took, so the chart knows."}
      </Text>

      {banner ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: tone.bg,
            borderRadius: 16,
            padding: 14,
            marginTop: 14,
          }}
        >
          <Ionicons name={tone.icon} size={28} color={tone.ink} />
          <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 19 * scale,
                lineHeight: 25 * scale,
                fontWeight: "800",
                color: tone.ink,
              }}
            >
              {banner.headline}
            </Text>
            <Text
              style={{
                fontSize: 15 * scale,
                lineHeight: 21 * scale,
                color: tone.ink,
              }}
            >
              {banner.detail}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Today's three slots at a glance, so a missed one is visible without
          opening History. */}
      <View style={{ flexDirection: "row", marginTop: 14 }}>
        {schedule.slots.map((slot, i) => {
          const state = SLOT_STATES[slot.state];
          return (
            <View
              key={slot.hour}
              style={{
                flex: 1,
                minWidth: 0,
                marginRight: i === schedule.slots.length - 1 ? 0 : 8,
                alignItems: "center",
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: state.bg,
                borderWidth: 1,
                borderColor: state.border,
              }}
            >
              <Ionicons name={state.icon} size={20} color={state.ink} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13 * scale,
                  fontWeight: "700",
                  color: state.ink,
                  marginTop: 3,
                }}
              >
                {slot.label.replace(":00", "")}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 11 * scale, color: state.ink }}
              >
                {state.word}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Three buttons rather than a single "taken" toggle: a missed dose is a
          clinically useful fact, and if the only easy action is "taken" it never
          gets recorded. */}
      <View style={{ marginTop: 16 }}>
        {DOSE_KINDS.map((kind) => (
          <Pressable
            key={kind.id}
            onPress={() => (pending === kind.id ? log(kind.id) : setPending(kind.id))}
            accessibilityRole="button"
            accessibilityState={{ selected: pending === kind.id }}
            accessibilityLabel={
              pending === kind.id ? `Confirm: ${kind.label}` : kind.label
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 64,
              paddingHorizontal: 16,
              marginBottom: 8,
              borderRadius: 14,
              backgroundColor: pending === kind.id ? kind.colour : kind.tint,
              borderWidth: 2,
              borderColor: pending === kind.id ? kind.colour : "transparent",
            }}
          >
            <Ionicons
              name={kind.icon}
              size={26}
              color={pending === kind.id ? "#ffffff" : kind.colour}
            />
            <Text
              style={{
                marginLeft: 10,
                flex: 1,
                minWidth: 0,
                fontSize: 18 * scale,
                fontWeight: "700",
                color: pending === kind.id ? "#ffffff" : kind.colour,
              }}
            >
              {pending === kind.id ? `Tap again to save: ${kind.label}` : kind.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {pending ? (
        <View style={{ marginTop: 2 }}>
          <Text
            style={{
              fontSize: 15 * scale,
              fontWeight: "600",
              color: "#334155",
              marginBottom: 6,
            }}
          >
            When? Leave blank for now.
          </Text>
          <TextInput
            value={timeText}
            onChangeText={setTimeText}
            placeholder="e.g. 7:15 am"
            placeholderTextColor="#64748b"
            accessibilityLabel="Time the dose was taken"
            style={{
              minHeight: 52,
              paddingHorizontal: 12,
              fontSize: 17 * scale,
              color: "#0f172a",
              backgroundColor: "#ffffff",
              borderWidth: 2,
              borderColor: "#cbd5e1",
              borderRadius: 12,
            }}
          />
        </View>
      ) : null}

      {justSaved ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#dcfce7",
            borderRadius: 16,
            padding: 14,
            marginTop: 12,
          }}
        >
          <Ionicons name="checkmark-circle" size={26} color="#166534" />
          <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 17 * scale, fontWeight: "700", color: "#166534" }}
            >
              {DOSE_KINDS.find((k) => k.id === justSaved.kind)?.short} at{" "}
              {justSaved.timeLabel}
            </Text>
            <Text style={{ fontSize: 14 * scale, color: "#166534" }}>
              Recorded by {justSaved.by}
            </Text>
          </View>
          <Pressable
            onPress={handleUndo}
            accessibilityRole="button"
            accessibilityLabel="Undo this dose"
            style={{
              minHeight: 52,
              paddingHorizontal: 18,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: "#ffffff",
              borderWidth: 2,
              borderColor: "#86efac",
            }}
          >
            <Text
              style={{ fontSize: 17 * scale, fontWeight: "700", color: "#166534" }}
            >
              Undo
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const SLOT_STATES = {
  taken: { bg: "#dcfce7", border: "#86efac", ink: "#166534", icon: "checkmark-circle", word: "Taken" },
  missed: { bg: "#fee2e2", border: "#fca5a5", ink: "#991b1b", icon: "close-circle", word: "Missed" },
  overdue: { bg: "#fef2f2", border: "#fca5a5", ink: "#991b1b", icon: "alert-circle", word: "Not logged" },
  due: { bg: "#ffedd5", border: "#fdba74", ink: "#9a3412", icon: "time", word: "Due now" },
  upcoming: { bg: "#f8fafc", border: "#cbd5e1", ink: "#475569", icon: "ellipse-outline", word: "Later" },
};
