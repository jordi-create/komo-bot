const redis = require("./redis");

// Conversation history auto-expires after 24h of inactivity.
const HISTORY_TTL = 60 * 60 * 24;

// === NOTES === (Redis hash: notes:<userId>)

async function saveNote(userId, key, content) {
  await redis.hset(`notes:${userId}`, {
    [key]: { content, savedAt: new Date().toISOString() },
  });
}

async function getNote(userId, key) {
  return (await redis.hget(`notes:${userId}`, key)) || null;
}

async function listNotes(userId) {
  const all = (await redis.hgetall(`notes:${userId}`)) || {};
  return Object.entries(all).map(([key, val]) => ({
    key,
    content: val.content,
    savedAt: val.savedAt,
  }));
}

async function deleteNote(userId, key) {
  const removed = await redis.hdel(`notes:${userId}`, key);
  return removed > 0;
}

// === CONVERSATION HISTORY === (Redis key: chat:<userId>)
// Stored WITHOUT the system prompt so the date/time stays fresh each call.

async function getHistory(userId) {
  return (await redis.get(`chat:${userId}`)) || [];
}

async function setHistory(userId, messages) {
  await redis.set(`chat:${userId}`, messages, { ex: HISTORY_TTL });
}

async function clearHistory(userId) {
  await redis.del(`chat:${userId}`);
}

// === REMINDERS === (Redis key: reminders => array of {id,userId,label,fireAt})
// Serverless can't hold setTimeout timers, so reminders are persisted and a
// cron (api/cron.js, or a local interval) checks for due ones every minute.

async function addReminder(userId, label, delayMs) {
  const reminders = (await redis.get("reminders")) || [];
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fireAt = Date.now() + delayMs;
  reminders.push({ id, userId, label, fireAt });
  await redis.set("reminders", reminders);
  return { id, fireAt: new Date(fireAt).toISOString() };
}

async function listReminders(userId) {
  const reminders = (await redis.get("reminders")) || [];
  return reminders
    .filter((r) => String(r.userId) === String(userId))
    .map((r) => ({ id: r.id, label: r.label, fireAt: new Date(r.fireAt).toISOString() }));
}

// Returns due reminders and removes them from storage in one pass.
async function popDueReminders() {
  const reminders = (await redis.get("reminders")) || [];
  if (reminders.length === 0) return [];
  const now = Date.now();
  const due = reminders.filter((r) => r.fireAt <= now);
  if (due.length === 0) return [];
  const remaining = reminders.filter((r) => r.fireAt > now);
  await redis.set("reminders", remaining);
  return due;
}

// === WHITELIST === (Redis set: whitelist)

async function getWhitelist() {
  const members = (await redis.smembers("whitelist")) || [];
  return members.map(Number).filter(Boolean);
}

async function addToWhitelist(userId) {
  await redis.sadd("whitelist", String(userId));
}

async function removeFromWhitelist(userId) {
  await redis.srem("whitelist", String(userId));
}

// === PENDING ACCESS REQUESTS === (Redis hash: pending, field = userId)
// Non-whitelisted users who message the bot get recorded here so an admin
// can review them with /pending and approve with /add.

async function addPending(userId, info) {
  await redis.hset("pending", {
    [String(userId)]: { ...info, at: new Date().toISOString() },
  });
}

async function listPending() {
  const all = (await redis.hgetall("pending")) || {};
  return Object.entries(all).map(([id, v]) => ({ id, ...v }));
}

async function removePending(userId) {
  await redis.hdel("pending", String(userId));
}

// === LONG-TERM MEMORY === (Redis key: memory:<userId> => array of {text, at})
// Persistent facts about a user, always injected into the system prompt so the
// bot "remembers" across days — separate from the 24h conversation history.

async function getMemories(userId) {
  return (await redis.get(`memory:${userId}`)) || [];
}

async function addMemory(userId, text) {
  const mems = await getMemories(userId);
  const clean = text.trim();
  if (!clean) return;
  // Skip near-duplicates.
  if (mems.some((m) => (m.text || "").toLowerCase() === clean.toLowerCase())) return;
  mems.push({ text: clean, at: new Date().toISOString() });
  // Keep only the most recent 50 facts.
  await redis.set(`memory:${userId}`, mems.slice(-50));
}

async function clearMemories(userId) {
  await redis.del(`memory:${userId}`);
}

module.exports = {
  saveNote,
  getNote,
  listNotes,
  deleteNote,
  getHistory,
  setHistory,
  clearHistory,
  addReminder,
  listReminders,
  popDueReminders,
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  addPending,
  listPending,
  removePending,
  getMemories,
  addMemory,
  clearMemories,
};
