import { useContext, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import Card from "../components/Card";
import MealLogCard from "../components/MealLogCard";
import { column, columns, page, useWide } from "../components/layout";
import SensorStatus from "../components/SensorStatusCard";
import StatusBadge from "../components/StatusBadge";
import SymptomForm from "../components/SymptomForm";
import ReporterToggle from "../components/ReporterToggle";
import TodayTrend from "../components/TodayTrend";
import { describeTrend, getTodayTrend } from "../data/history";
import { describeForecast, forecastOff } from "../data/forecast";
import { patients } from "../data/patients";
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
  const { user } = useContext(RoleContext);
  const { scale } = useContext(AccessibilityContext);
  const wide = useWide();
  const patient = patients.find((p) => p.id === user) || patients[0];
  const firstName = firstNameOf(patient.name);
  const greeting = greetingFor(new Date().getHours());

  // Saving and undo now live in SymptomForm, which owns the whole check-in.
  const [showForecastInfo, setShowForecastInfo] = useState(false);

  const trend = getTodayTrend(patient.id);
  const forecast = describeForecast(forecastOff(patient.id));

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={page(undefined, 24)}
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
        {greeting}, {firstName}
      </Text>
      <View style={{ marginTop: 10, marginBottom: 18 }}>
        <SensorStatus
          isConnected={patient.connected}
          batteryPct={patient.batteryPct}
        />
      </View>

      {/* Who is holding the phone. Set once, then everything recorded is
          attributed to them. */}
      <ReporterToggle />

      {/* Two columns on a wide screen so the page fills the space without any
          one card growing an over-long line. Stacks on a phone. */}
      <View style={columns(wide, 24)}>
      <View style={column(wide)}>

      {/* Current level */}
      <Card
        title="Your level"
        speakText={`Your level is ${patient.level} ng/mL, ${
          patient.inRange ? "in range" : "out of range"
        }. Updated ${patient.lastUpdated}.`}
      >
        <View className="flex-row items-end">
          <Text className="text-6xl font-bold text-gray-900">{patient.level}</Text>
          <Text className="text-2xl text-gray-600 ml-2 mb-2">{patient.unit}</Text>
        </View>
        <View className="mt-4">
          <StatusBadge
            tone={patient.inRange ? "good" : "warn"}
            label={patient.inRange ? "In range" : "Out of range"}
          />
        </View>
        <Text className="text-base text-gray-600 mt-4">
          Updated {patient.lastUpdated}
        </Text>
      </Card>

      {/* Trend */}
      <Card
        title="Today's trend"
        subtitle="Midnight to now, in 24 steps"
        speakText={`Today's trend. ${describeTrend(trend)}`}
      >
        <Text className="text-base text-gray-700 mb-4">{describeTrend(trend)}</Text>
        <TodayTrend points={trend} />
      </Card>

      {/* Meals affect absorption, so they sit alongside the level and trend */}
      <MealLogCard patientId={patient.id} />

      </View>
      <View style={column(wide)}>

      {/* Symptom check-in, including sleep and a free-text note */}
      <SymptomForm patientId={patient.id} />


      {/* Forecast sits under the symptom check-in: what you have just reported
          and what is likely to happen next belong together. */}
      {forecast ? (
        <ForecastCard
          forecast={forecast}
          scale={scale}
          showInfo={showForecastInfo}
          onToggleInfo={() => setShowForecastInfo(!showForecastInfo)}
        />
      ) : null}

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
