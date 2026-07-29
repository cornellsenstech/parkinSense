import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import "./global.css";
import Home from "./screens/Home";
import History from "./screens/History";
import Help from "./screens/Help";
import Profile from "./screens/Profile";
import RoleSelect from "./screens/RoleSelect";
import PatientLogin from "./screens/PatientLogin";
import DoctorHome from "./screens/doctor/DoctorHome";
import Messages from "./screens/doctor/Messages";
import { RoleContext } from "./context/RoleContext";

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
      <PatientTabs.Screen name="Help" component={Help} />
      <PatientTabs.Screen name="Profile" component={Profile} />
    </PatientTabs.Navigator>
  );
}

function DoctorPortal() {
  return (
    <DoctorTabs.Navigator initialRouteName="Patients" screenOptions={tabScreenOptions}>
      <DoctorTabs.Screen name="Patients" component={DoctorHome} />
      <DoctorTabs.Screen name="Messages" component={Messages} />
      <DoctorTabs.Screen name="Profile" component={Profile} />
    </DoctorTabs.Navigator>
  );
}

export default function App() {
  const [role, setRole] = useState(getInitialRole());
  const [user, setUser] = useState(null);

  // Leaving a portal clears the signed-in patient.
  useEffect(() => {
    if (role == null && user != null) setUser(null);
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  function renderBody() {
    if (role == null) return <RoleSelect />;
    if (role === "patient" && user == null) return <PatientLogin />;
    return (
      <NavigationContainer key={role}>
        {role === "doctor" ? <DoctorPortal /> : <PatientPortal />}
      </NavigationContainer>
    );
  }

  return (
    <RoleContext.Provider value={{ role, setRole, user, setUser }}>
      {renderBody()}
    </RoleContext.Provider>
  );
}
