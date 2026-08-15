import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AssistantDock from "./components/AssistantDock";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import "./global.css";
import Home from "./screens/Home";
import History from "./screens/History";
import Help from "./screens/Help";
import Community from "./screens/Community";
import Profile from "./screens/Profile";
import RoleSelect from "./screens/RoleSelect";
import PatientLogin from "./screens/PatientLogin";
import DoctorHome from "./screens/doctor/DoctorHome";
import Messages from "./screens/doctor/Messages";
import { RoleContext } from "./context/RoleContext";
import { AccessibilityProvider } from "./context/AccessibilityContext";
import { getConversations, needsDoctor } from "./data/messages";
import { seedIfEmpty } from "./data/seed";
import { patients } from "./data/patients";

// On web, allow ?role=patient or ?role=doctor to pre-select a portal so
// each can be opened in its own browser tab.
function getInitialRole() {
  if (typeof window !== "undefined" && window.location && window.location.search) {
    const r = new URLSearchParams(window.location.search).get("role");
    if (r === "doctor" || r === "patient") return r;
  }
  return null;
}

const ICONS = {
  Home: "home",
  History: "stats-chart",
  Community: "location",
  Help: "medkit",
  Profile: "person",
  Patients: "people",
  Messages: "chatbubbles",
};

function tabScreenOptions({ route }) {
  return {
    headerShown: false,
    tabBarActiveTintColor: "#111827",
    tabBarInactiveTintColor: "#9ca3af",
    tabBarLabelStyle: { fontSize: 14 },
    tabBarStyle: { height: 68, paddingBottom: 10, paddingTop: 8 },
    tabBarIcon: ({ color, size }) => (
      <Ionicons name={ICONS[route.name] || "ellipse"} size={size} color={color} />
    ),
  };
}

const PatientTabs = createBottomTabNavigator();
const DoctorTabs = createBottomTabNavigator();

function PatientPortal() {
  return (
    <PatientTabs.Navigator initialRouteName="Home" screenOptions={tabScreenOptions}>
      <PatientTabs.Screen name="Home" component={Home} />
      <PatientTabs.Screen name="History" component={History} />
      <PatientTabs.Screen name="Community" component={Community} />
      <PatientTabs.Screen name="Help" component={Help} />
      <PatientTabs.Screen name="Profile" component={Profile} />
    </PatientTabs.Navigator>
  );
}

function DoctorPortal() {
  // Count of conversations where a patient spoke last, so the Messages tab can
  // show a badge without the doctor having to open it to find out.
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let active = true;
    const check = () =>
      getConversations().then((list) => {
        if (active) setWaiting(list.filter(needsDoctor).length);
      });
    check();
    const timer = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <DoctorTabs.Navigator initialRouteName="Patients" screenOptions={tabScreenOptions}>
      <DoctorTabs.Screen name="Patients" component={DoctorHome} />
      <DoctorTabs.Screen
        name="Messages"
        component={Messages}
        options={{
          // undefined rather than 0, or the badge would render an empty circle.
          tabBarBadge: waiting || undefined,
          tabBarBadgeStyle: { backgroundColor: "#dc2626", color: "#ffffff" },
        }}
      />
      <DoctorTabs.Screen name="Profile" component={Profile} />
    </DoctorTabs.Navigator>
  );
}

export default function App() {
  const [role, setRole] = useState(getInitialRole());
  const [user, setUser] = useState(null);
  const [reporter, setReporter] = useState("patient");
  const [seeded, setSeeded] = useState(false);

  // Seed two days of demo history for every patient, not just whoever signs in.
  // The doctor portal reads all four records, so seeding only the logged-in
  // patient left the clinician looking at empty symptom and meal charts.
  useEffect(() => {
    setSeeded(false);
    Promise.all(patients.map((p) => seedIfEmpty(p.id))).finally(() =>
      setSeeded(true)
    );
  }, []);

  // Leaving a portal clears the signed-in patient.
  useEffect(() => {
    if (role == null && user != null) setUser(null);
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  function renderBody() {
    if (role == null) return <RoleSelect />;
    if (role === "patient" && user == null) return <PatientLogin />;
    // Wait for seeding, or screens would mount against an empty store and show
    // no history until they happened to reload.
    if (!seeded) return null;
    return (
      <NavigationContainer key={role}>
        {role === "doctor" ? <DoctorPortal /> : <PatientPortal />}
        {/* Outside the navigator, so the dock persists across tab changes
            instead of unmounting and losing a loaded model every time the
            patient moves between screens. */}
        <AssistantDock />
      </NavigationContainer>
    );
  }

  return (
    // SafeAreaProvider at the root rather than relying on the one React
    // Navigation mounts around the tab view. Anything rendered as a sibling of
    // the navigator — the assistant dock — sits outside that inner provider and
    // would throw on useSafeAreaInsets(). It supplies context only; it adds no
    // padding of its own, so nothing else in the tree shifts.
    <SafeAreaProvider>
      <AccessibilityProvider>
        <RoleContext.Provider
          value={{ role, setRole, user, setUser, reporter, setReporter }}
        >
          {renderBody()}
        </RoleContext.Provider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
