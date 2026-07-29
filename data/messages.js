import AsyncStorage from "@react-native-async-storage/async-storage";

// Messages from patients to their care team. One shared list rather than a
// per-patient one, because the doctor reads them as a single inbox.
const KEY = "parkinsense:messages";

export const QUICK_MESSAGES = [
  { id: "fall", text: "I have fallen and need help", urgent: true },
  { id: "frozen", text: "I cannot move — I am frozen", urgent: true },
  { id: "worse", text: "My symptoms are much worse than usual", urgent: false },
  { id: "dose", text: "I have a question about my medication", urgent: false },
];

export async function getMessages() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    const list = saved ? JSON.parse(saved) : [];
    // Urgent first, then newest — the order a doctor needs to read them in.
    return list.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return b.sentAt - a.sentAt;
    });
  } catch {
    return [];
  }
}

export async function sendMessage({ patientId, patientName, text, urgent }) {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    const list = saved ? JSON.parse(saved) : [];
    const message = {
      id: `m-${list.length}-${text.length}-${patientId}`,
      patientId,
      patientName,
      text,
      urgent: Boolean(urgent),
      // Stored as a number so sorting never depends on date parsing.
      sentAt: Date.now(),
      timeLabel: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
      read: false,
    };
    await AsyncStorage.setItem(KEY, JSON.stringify([message, ...list]));
    return true;
  } catch {
    return false;
  }
}

export async function markRead(messageId) {
  return update(messageId, (message) => ({ ...message, read: true }));
}

// A doctor's reply is attached to the message it answers, so the patient sees
// the exchange as a thread rather than a loose inbox. Replying also marks the
// message handled — answering it is what "handled" means.
export async function replyToMessage(messageId, text) {
  const reply = {
    text: text.trim(),
    sentAt: Date.now(),
    timeLabel: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
  return update(messageId, (message) => ({ ...message, reply, read: true }));
}

// Read, change one message, write back. Shared so every mutation follows the
// same path and can't drift.
async function update(messageId, change) {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    const list = saved ? JSON.parse(saved) : [];
    const next = list.map((m) => (m.id === messageId ? change(m) : m));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

// The patient only sees their own messages.
export async function getMessagesFor(patientId) {
  const all = await getMessages();
  return all.filter((m) => m.patientId === patientId);
}
