import { useContext, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import Card from "../components/Card";
import DoseCard from "../components/DoseCard";
import ExerciseLogCard from "../components/ExerciseLogCard";
import MealLogCard from "../components/MealLogCard";
import { column, columns, page, useWide } from "../components/layout";
import SensorStatus from "../components/SensorStatusCard";
import StatusBadge from "../components/StatusBadge";
import SymptomForm from "../components/SymptomForm";
import ReporterToggle from "../components/ReporterToggle";
import TodayTrend from "../components/TodayTrend";
import {
  describeTrend,
  dyskinesiaRisk,
  getTodayTrend,
  rangeFor,
  trendDirection,
} from "../data/history";
import { describeForecast, forecastOff } from "../data/forecast";
import { dosesToday, loadDoses } from "../data/doseLog";
import { patients } from "../data/patients";
import { defaultProfile, displayFirstName, loadProfile } from "../data/profile";
import { RoleContext } from "../context/RoleContext";
import { AccessibilityContext } from "../context/AccessibilityContext";

// Someone recorded as "Dr. Alan Reed" should be greeted as Alan, not Dr.
const TITLES = ["mr", "mrs", "ms", "miss", "dr", "prof"];

function firstNameOf(fullName) {
  const parts = fullName.split(" ");
  const first = parts[0].replace(".", "").toLowerCase();
  return TITLES.includes(first) && parts.length > 1 ? parts[1] : parts[0];
}

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { user, reporter } = useContext(RoleContext);
  const { scale } = useContext(AccessibilityContext);
  const wide = useWide();
  const patient = patients.find((p) => p.id === user) || patients[0];
  const firstName = firstNameOf(patient.name);
  const greeting = greetingFor(new Date().getHours());

  // Saving and undo now live in SymptomForm, which owns the whole check-in.
  const [showForecastInfo, setShowForecastInfo] = useState(false);

  // The greeting addresses whoever is holding the phone, so it needs the saved
  // profile to know the caregiver's name.
  const [profile, setProfile] = useState(() => defaultProfile(user));
  useEffect(() => {
    let active = true;
    loadProfile(user).then((saved) => {
      if (active) setProfile(saved);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const greetName = displayFirstName(profile, reporter) || firstName;

  const trend = getTodayTrend(patient.id);
  // Today's dose log feeds the forecast so it can decline when a scheduled dose
  // lands before the projected off-period. Without it the model extrapolates
  // through a dose it cannot see, which was the single largest source of error.
  const [doses, setDoses] = useState([]);
  useEffect(() => {
    let active = true;
    loadDoses(patient.id).then((list) => {
      if (active) setDoses(list);
    });
    return () => {
      active = false;
    };
  }, [patient.id]);

  const forecast = describeForecast(forecastOff(patient.id, dosesToday(doses)));

  // The window is this patient's, not a fixed 500-1500 — it narrows with
  // disease duration and with dyskinesia, so showing everyone the same band
  // would tell three of the four patients something untrue about their own
  // readings.
  const range = rangeFor(patient.id);
  const direction = trendDirection(trend);
  const dyskinesia = dyskinesiaRisk(patient.level, patient.id, direction);

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      // Wider than the other screens, because Home carries three columns.
      contentContainerStyle={page(wide ? 1320 : undefined, 24)}
    >
      {/* Greeting and device on one compact line each, rather than two big
          blocks — the level below is what deserves the space. */}
      <Text
        style={{
          fontSize: 30 * scale,
          lineHeight: 36 * scale,
          fontWeight: "800",
          letterSpacing: -0.4,
          color: "#0f172a",
        }}
      >
        {greeting}, {greetName}
      </Text>
      {reporter === "caregiver" ? (
        <Text style={{ fontSize: 16 * scale, color: "#475569", marginTop: 2 }}>
          Recording for {firstName}
        </Text>
      ) : null}
      <View style={{ marginTop: 10, marginBottom: 18 }}>
        <SensorStatus
          isConnected={patient.connected}
          batteryPct={patient.batteryPct}
        />
      </View>

      {/* Who is holding the phone. Set once, then everything recorded is
          attributed to them. */}
      <ReporterToggle />

      {/* Three columns on a wide screen: the readings on the left, then the two
          things you record side by side. Keeping the check-in and the meal log
          in separate columns rather than stacked roughly halves the scroll.
          Stacks into one column on a phone. */}
      <View style={columns(wide, 20)}>
      <View style={column(wide)}>

      {/* Level and trend in one card: the current number and where it is
          heading are the same question, and splitting them made the reader
          look in two places. */}
      <Card
        title="Your level"
        speakText={`Your level is ${patient.level} ng/mL, ${
          patient.inRange ? "in range" : "out of range"
        }. ${describeTrend(trend)}`}
      >
        <View className="flex-row items-end justify-between">
          <View className="flex-row items-end">
            <Text className="text-6xl font-bold text-gray-900">
              {patient.level}
            </Text>
            <Text className="text-2xl text-gray-600 ml-2 mb-2">
              {patient.unit}
            </Text>
          </View>
          <View className="mb-2">
            <StatusBadge
              tone={patient.inRange ? "good" : "warn"}
              label={patient.inRange ? "In range" : "Out of range"}
            />
          </View>
        </View>

        <Text className="text-base text-gray-600 mt-2">
          Updated {patient.lastUpdated} · Your range is {range.low} to{" "}
          {range.high} ng/mL
        </Text>

        {/* Extra movements are not only a high-level problem. Peak-dose
            dyskinesia happens near the top of the range, but diphasic
            dyskinesia happens while the level is climbing into or falling out
            of it — so a patient with a low reading and extra movements is
            describing something real, not something impossible. */}
        {dyskinesia.risk ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              backgroundColor: "#fdf4ff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#f0abfc",
              padding: 12,
              marginTop: 12,
            }}
          >
            <Ionicons name="pulse" size={22} color="#a21caf" />
            <Text
              style={{
                marginLeft: 8,
                flex: 1,
                minWidth: 0,
                fontSize: 15 * scale,
                lineHeight: 21 * scale,
                color: "#86198f",
              }}
            >
              {dyskinesia.note}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: "#e2e8f0",
          }}
        >
          <Text className="text-base font-semibold text-gray-900">
            Today so far
          </Text>
          <Text className="text-base text-gray-700 mb-3">
            {describeTrend(trend, patient.id)}
          </Text>
          <TodayTrend points={trend} patientId={patient.id} />
        </View>
      </Card>

      {/* Forecast follows the level it is derived from */}
      {forecast ? (
        <ForecastCard
          forecast={forecast}
          scale={scale}
          showInfo={showForecastInfo}
          onToggleInfo={() => setShowForecastInfo(!showForecastInfo)}
        />
      ) : null}

      {/* Doses sit under the forecast because they answer the question the
          forecast raises: the level is falling, is that the medication wearing
          off on schedule or is there none on board? */}
      <DoseCard patientId={patient.id} />

      </View>
      <View style={column(wide)}>

      {/* Symptom check-in, including sleep and a free-text note */}
      <SymptomForm patientId={patient.id} />

      </View>
      <View style={column(wide)}>

      {/* The two things that change how the medication works: what was eaten,
          and how much the patient moved. */}
      <MealLogCard patientId={patient.id} />
      <ExerciseLogCard patientId={patient.id} />

      </View>
      </View>
    </ScrollView>
  );
}

// The forecast, with an (i) that explains where the number comes from.
//
// Patients are being shown a prediction about their own body, so how it was
// worked out and its limits have to be one tap away — and it must never read as
// an instruction to change medication.
function ForecastCard({ forecast, scale, showInfo, onToggleInfo }) {
  const tone =
    forecast.tone === "warn"
      ? { ink: "#9a3412", bg: "#ffedd5", icon: "trending-down" }
      : forecast.tone === "good"
      ? { ink: "#166534", bg: "#dcfce7", icon: "trending-up" }
      : { ink: "#3d5257", bg: "#eaf0f1", icon: "remove-outline" };

  return (
    <View className="bg-white rounded-3xl border border-gray-200 p-6 mb-5">
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text
          style={{
            flex: 1,
            fontSize: 24 * scale,
            lineHeight: 30 * scale,
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          Next off period
        </Text>

        <Pressable
          onPress={onToggleInfo}
          accessibilityRole="button"
          accessibilityState={{ expanded: showInfo }}
          accessibilityLabel="What does this mean?"
          style={{
            width: 48,
            height: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            backgroundColor: showInfo ? "#0f172a" : "#f1f5f9",
            borderWidth: 1,
            borderColor: showInfo ? "#0f172a" : "#cbd5e1",
          }}
        >
          <Ionicons
            name="information"
            size={24}
            color={showInfo ? "#ffffff" : "#334155"}
          />
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: tone.bg,
          borderRadius: 16,
          padding: 16,
          marginTop: 14,
        }}
      >
        <Ionicons name={tone.icon} size={30} color={tone.ink} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text
            style={{
              fontSize: 24 * scale,
              lineHeight: 30 * scale,
              fontWeight: "800",
              color: tone.ink,
            }}
          >
            {forecast.headline}
          </Text>
          <Text
            style={{
              fontSize: 17 * scale,
              lineHeight: 24 * scale,
              color: tone.ink,
              marginTop: 2,
            }}
          >
            {forecast.detail}
          </Text>
        </View>
      </View>

      {showInfo ? (
        <View
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            backgroundColor: "#f8fafc",
            borderWidth: 1,
            borderColor: "#cbd5e1",
          }}
        >
          <Text
            style={{
              fontSize: 17 * scale,
              lineHeight: 25 * scale,
              color: "#3d5257",
            }}
          >
            Your medicine clears from your blood at a steady rate. The app looks
            at the trend across your readings from the last hour and a half —
            not just the latest one — works out how fast your level is dropping,
            and estimates when it will fall below your usual range, the point
            where symptoms often return.
          </Text>
          <Text
            style={{
              fontSize: 17 * scale,
              lineHeight: 25 * scale,
              color: "#3d5257",
              marginTop: 12,
            }}
          >
            It is an estimate, not a certainty — which is why you see a range
            rather than an exact time. Food, activity and sleep all change how
            quickly your level falls, and no estimate is shown at all when your
            level is rising or your readings are too uneven to read a trend
            from.
          </Text>
          <Text
            style={{
              fontSize: 17 * scale,
              lineHeight: 25 * scale,
              fontWeight: "700",
              color: "#9a3412",
              marginTop: 12,
            }}
          >
            Never change your medication or its timing based on this. Talk to
            your care team first.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
