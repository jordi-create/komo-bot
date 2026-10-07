const storage = require("./storage");

// Fires any due reminders by sending them to the user. Used by both the local
// interval (index.js) and the serverless cron endpoint (api/cron.js).
async function fireDueReminders(bot) {
  const due = await storage.popDueReminders();
  for (const r of due) {
    try {
      await bot.telegram.sendMessage(
        r.userId,
        `⏰ REMINDER: ${r.label}\n\n— Komo nggak pernah lupa, beda sama kamu.`
      );
    } catch (err) {
      console.error("Failed to send reminder:", err.message);
    }
  }
  return due.length;
}

module.exports = { fireDueReminders };
