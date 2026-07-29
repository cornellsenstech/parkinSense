// Mock patient roster shared by both portals. `level` is levodopa plasma
// concentration in ng/mL; therapeutic window is 500–1500 (see data/history.js).
//
// Weight and height are clinical fields, not decoration: levodopa dosing and
// clearance both depend on them. Written out in words rather than symbols so
// the read-aloud layer speaks them correctly.
//
// These are invented people on an example.com domain — no real patient data.
export const patients = [
  {
    id: "robert",
    name: "Robert Ellis",
    age: 62,
    weight: "165 lbs",
    height: "5 ft 8 in",
    email: "robert.ellis@example.com",
    level: 1120,
    unit: "ng/mL",
    inRange: true,
    connected: true,
    batteryPct: 10,
    stiffness: 1,
    tremor: 2,
    lastUpdated: "4 minutes ago",
    status: "stable",
  },
  {
    id: "margaret",
    name: "Margaret Chen",
    age: 68,
    weight: "140 lbs",
    height: "5 ft 5 in",
    email: "margaret.chen@example.com",
    level: 430,
    unit: "ng/mL",
    inRange: false,
    connected: true,
    batteryPct: 82,
    stiffness: 3,
    tremor: 3,
    lastUpdated: "12 minutes ago",
    status: "attention",
  },
  {
    id: "frank",
    name: "Frank Delgado",
    age: 71,
    weight: "190 lbs",
    height: "5 ft 10 in",
    email: "frank.delgado@example.com",
    level: 990,
    unit: "ng/mL",
    inRange: true,
    connected: false,
    batteryPct: 0,
    stiffness: 0,
    tremor: 1,
    lastUpdated: "2 hours ago",
    status: "offline",
  },
  {
    id: "helen",
    name: "Helen Okafor",
    age: 57,
    weight: "155 lbs",
    height: "5 ft 7 in",
    email: "helen.okafor@example.com",
    level: 1740,
    unit: "ng/mL",
    inRange: false,
    connected: true,
    batteryPct: 55,
    stiffness: 2,
    tremor: 4,
    lastUpdated: "just now",
    status: "attention",
  },
];

// The clinician shown across the doctor portal.
export const DOCTOR_NAME = "Dr. Elena Vasquez";
