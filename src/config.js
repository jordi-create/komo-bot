require("dotenv").config();

module.exports = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  gmiApiKey: process.env.GMI_API_KEY,
  gmiBaseUrl: "https://api.gmi-serving.com/v1",
  model: "deepseek-ai/DeepSeek-V4-Pro-0813",
  visionModel: process.env.VISION_MODEL || "google/gemini-3.5-flash",
  allowedUserIds: (process.env.ALLOWED_USER_IDS || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean),
  adminUserIds: (process.env.ADMIN_USER_IDS || process.env.ALLOWED_USER_IDS || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean),
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "",
  // Tavily — search API buat bot AI (utama buat web_search). Gratis ~1000/bulan.
  // Ambil key di https://tavily.com (format: tvly-...).
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  // Google Custom Search JSON API (opsional, cadangan). Catatan: di sebagian akun
  // Google Workspace org ini keblokir org policy (403), makanya default-nya dimatiin.
  googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "",
  googleSearchCx: process.env.GOOGLE_SEARCH_CX || "",
};
