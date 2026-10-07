// Local development entry point — runs the bot with long polling.
// On Vercel the bot runs via webhook (api/webhook.js) instead, and reminders
// are fired by api/cron.js. Don't run this at the same time as the webhook:
// Telegram allows either polling OR a webhook, not both.
const bot = require("./bot");
const { fireDueReminders } = require("./reminders");

bot.launch().then(() => {
  console.log("Bot is running (local polling)!");
});

// Check for due reminders every 30s locally.
setInterval(() => {
  fireDueReminders(bot).catch((e) => console.error("Reminder poll error:", e.message));
}, 30000);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
