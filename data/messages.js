import AsyncStorage from "@react-native-async-storage/async-storage";

// Conversations between a patient and their care team.
//
// Each entry is a thread, not a single message: `turns` is an ordered list of
// who said what, so either side can keep replying. One shared list rather than
// a per-patient one, because the doctor reads them as a single inbox.
const KEY = "parkinsense:messages";

// Deliberately no emergency options. A message here may not be read for hours,
// so anything life-threatening must go to 911 rather than into a queue — the
// Help screen says so prominently instead of offering a button that could give
// someone false confidence that help is coming.
export const QUICK_MESSAGES = [
  { id: "worse", text: "My symptoms are much worse than usual" },
  { id: "dose", text: "I have a question about my medication" },
  { id: "sideeffect", text: "I think I am having a side effect" },
  { id: "appointment", text: "I would like to arrange an appointment" },
];

function clockLabel(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// `from` is which side of the conversation spoke. `by` records who actually
// typed it, so a caregiver writing on the patient's behalf is visible to the
// clinician rather than being passed off as the patient's own words.
function makeTurn(from, text, by) {
  const now = new Date();
  return {
    from, // "patient" | "doctor"
    by: from === "patient" ? (by === "caregiver" ? "caregiver" : "patient") : null,
    text: text.trim(),
    sentAt: now.getTime(),
    timeLabel: clockLabel(now),
  };
}

// Who wrote a turn, in words. Used by both portals so they cannot disagree.
export function turnAuthor(turn, patientFirstName) {
  if (turn.from === "doctor") return "doctor";
  return turn.by === "caregiver"
    ? `caregiver${patientFirstName ? ` for ${patientFirstName}` : ""}`
    : patientFirstName || "patient";
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
    closed: Boolean(entry.read || entry.handled),
    turns,
  };
}

export function lastTurn(conversation) {
  return conversation.turns[conversation.turns.length - 1];
}

export function isOpen(conversation) {
  return !conversation.closed;
}

// The doctor's cue: the patient spoke last and the thread is still open.
export function needsDoctor(conversation) {
  return isOpen(conversation) && lastTurn(conversation).from === "patient";
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

export async function startConversation({
  patientId,
  patientName,
  text,
  urgent,
  by,
}) {
  if (!text.trim()) return false;
  const list = await readAll();
  const conversation = {
    id: `c-${Date.now()}-${patientId}`,
    patientId,
    patientName,
    urgent: Boolean(urgent),
    closed: false,
    turns: [makeTurn("patient", text, by)],
  };
  return writeAll([conversation, ...list]);
}

// Either side can keep adding turns until the doctor closes the thread. A
// closed conversation is read-only, so the record of what was said cannot be
// changed after the clinician signed it off.
export async function addTurn(conversationId, from, text, by) {
  if (!text.trim()) return false;
  const list = await readAll();
  const target = list.find((c) => c.id === conversationId);
  if (!target || target.closed) return false;

  const next = list.map((c) =>
    c.id === conversationId
      ? { ...c, turns: [...c.turns, makeTurn(from, text, by)] }
      : c
  );
  return writeAll(next);
}

// Only the doctor closes a conversation. Once closed the patient starts a new
// one rather than reopening this one.
export async function closeConversation(conversationId) {
  const list = await readAll();
  const next = list.map((c) =>
    c.id === conversationId ? { ...c, closed: true } : c
  );
  return writeAll(next);
}

// A patient should be adding to their live thread rather than opening a second
// one alongside it.
export function findOpen(conversations) {
  return conversations.find(isOpen) || null;
}
