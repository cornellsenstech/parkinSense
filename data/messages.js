import AsyncStorage from "@react-native-async-storage/async-storage";

// Conversations between a patient and their care team.
//
// Each entry is a thread, not a single message: `turns` is an ordered list of
// who said what, so either side can keep replying. One shared list rather than
// a per-patient one, because the doctor reads them as a single inbox.
const KEY = "parkinsense:messages";

export const QUICK_MESSAGES = [
  { id: "fall", text: "I have fallen and need help", urgent: true },
  { id: "frozen", text: "I cannot move — I am frozen", urgent: true },
  { id: "worse", text: "My symptoms are much worse than usual", urgent: false },
  { id: "dose", text: "I have a question about my medication", urgent: false },
];

function clockLabel(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function makeTurn(from, text) {
  const now = new Date();
  return {
    from, // "patient" | "doctor"
    text: text.trim(),
    sentAt: now.getTime(),
    timeLabel: clockLabel(now),
  };
}

// Conversations saved before threads existed had a single `text` plus an
// optional `reply`. Convert them on read so old demo data still opens.
function migrate(entry) {
  if (Array.isArray(entry.turns)) return entry;

  const turns = [
    {
      from: "patient",
      text: entry.text,
      sentAt: entry.sentAt,
      timeLabel: entry.timeLabel,
    },
  ];
  if (entry.reply) turns.push({ from: "doctor", ...entry.reply });

  return {
    id: entry.id,
    patientId: entry.patientId,
    patientName: entry.patientName,
    urgent: Boolean(entry.urgent),
    handled: Boolean(entry.read),
    turns,
  };
}

export function lastTurn(conversation) {
  return conversation.turns[conversation.turns.length - 1];
}

// The doctor's cue: the patient spoke last and nobody has closed it off.
export function needsDoctor(conversation) {
  return !conversation.handled && lastTurn(conversation).from === "patient";
}

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw).map(migrate) : [];
  } catch {
    return [];
  }
}

async function writeAll(list) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Urgent and waiting first, then whatever moved most recently — the order a
// doctor needs to read them in.
function triageOrder(a, b) {
  const aWaiting = needsDoctor(a);
  const bWaiting = needsDoctor(b);
  if (aWaiting !== bWaiting) return aWaiting ? -1 : 1;
  if (aWaiting && a.urgent !== b.urgent) return a.urgent ? -1 : 1;
  return lastTurn(b).sentAt - lastTurn(a).sentAt;
}

export async function getConversations() {
  const list = await readAll();
  return list.sort(triageOrder);
}

// The patient only sees their own threads.
export async function getConversationsFor(patientId) {
  const all = await getConversations();
  return all.filter((c) => c.patientId === patientId);
}

export async function startConversation({ patientId, patientName, text, urgent }) {
  if (!text.trim()) return false;
  const list = await readAll();
  const conversation = {
    id: `c-${Date.now()}-${patientId}`,
    patientId,
    patientName,
    urgent: Boolean(urgent),
    handled: false,
    turns: [makeTurn("patient", text)],
  };
  return writeAll([conversation, ...list]);
}

// Adding a turn reopens the thread: a patient replying to a closed
// conversation should put it back in front of the doctor.
export async function addTurn(conversationId, from, text) {
  if (!text.trim()) return false;
  const list = await readAll();
  const next = list.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          turns: [...c.turns, makeTurn(from, text)],
          handled: from === "doctor" ? c.handled : false,
        }
      : c
  );
  return writeAll(next);
}

export async function markHandled(conversationId) {
  const list = await readAll();
  const next = list.map((c) =>
    c.id === conversationId ? { ...c, handled: true } : c
  );
  return writeAll(next);
}
