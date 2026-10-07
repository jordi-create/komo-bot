const bot = require("../src/bot");

// Cache botInfo across warm invocations so Telegraf can match commands.
let botInfoPromise;

module.exports = async (req, res) => {
  // Health check / browser visit
  if (req.method !== "POST") {
    return res.status(200).send("Komo bot webhook is alive 🐱");
  }

  try {
    if (!bot.botInfo) {
      botInfoPromise = botInfoPromise || bot.telegram.getMe();
      bot.botInfo = await botInfoPromise;
    }
    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    await bot.handleUpdate(update);
  } catch (err) {
    // Always 200 so Telegram doesn't retry-storm us on an app error.
    console.error("Webhook error:", err.stack || err.message);
  }

  return res.status(200).json({ ok: true });
};
