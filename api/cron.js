const bot = require("../src/bot");
const { fireDueReminders } = require("../src/reminders");

// Hit this every minute from an external cron (e.g. cron-job.org):
//   https://<project>.vercel.app/api/cron?secret=<CRON_SECRET>
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const provided = req.query.secret || req.headers["x-cron-secret"];
  if (secret && provided !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const fired = await fireDueReminders(bot);
    return res.status(200).json({ ok: true, fired });
  } catch (err) {
    console.error("Cron error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
