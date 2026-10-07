const { Telegraf } = require("telegraf");
const config = require("./config");
const { chat, chatWithImage, clearHistory } = require("./ai");
const { setImageCallback } = require("./tools");
const storage = require("./storage");
const path = require("path");
const https = require("https");
const http = require("http");

const bot = new Telegraf(config.telegramToken);

function isAdmin(userId) {
  return config.adminUserIds.includes(userId);
}

// Access check. Allowed = admins + env ALLOWED_USER_IDS + Redis whitelist.
// If nothing is configured anywhere, the bot is open to everyone.
async function isAllowed(userId) {
  if (isAdmin(userId)) return true;
  if (config.allowedUserIds.includes(userId)) return true;
  const whitelist = await storage.getWhitelist();
  if (whitelist.includes(userId)) return true;
  if (config.allowedUserIds.length === 0 && whitelist.length === 0) return true;
  return false;
}

// Records a non-whitelisted requester (so admin can review with /pending),
// then sends them the "no access" reply.
async function denyAccess(ctx) {
  try {
    await storage.addPending(ctx.from.id, {
      name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" "),
      username: ctx.from.username || "",
    });
  } catch (e) {
    console.error("addPending failed:", e.message);
  }
  return ctx.reply(
    `Maaf, kamu belum punya akses ke bot ini.\nID kamu: ${ctx.from.id}\nMinta admin untuk whitelist kamu.`
  );
}

// Setup image callback — sends generated image to user
setImageCallback((userId, imgSource, prompt, isBase64) => {
  const caption = `🎨 "${prompt}"`;
  let sendPromise;

  if (isBase64) {
    const buf = Buffer.from(imgSource, "base64");
    sendPromise = bot.telegram.sendPhoto(userId, { source: buf, filename: "komo-art.png" }, { caption });
  } else {
    sendPromise = bot.telegram.sendPhoto(userId, imgSource, { caption });
  }

  sendPromise.catch((err) => {
    console.error("Failed to send image:", err.message);
    if (!isBase64) {
      bot.telegram.sendMessage(userId, `Gambarnya gagal dikirim, tapi bisa dibuka di sini: ${imgSource}`);
    } else {
      bot.telegram.sendMessage(userId, "Waduh, gambarnya gagal dikirim. Coba lagi ya.");
    }
  });
});

// /start
bot.start(async (ctx) => {
  if (!(await isAllowed(ctx.from.id))) return denyAccess(ctx);
  ctx.reply(
    "Halo! Gua KOMO SI CUKING PINTAR 🐱\n\n" +
      "Yang bisa gue lakuin:\n" +
      "💬 Chat / tanya apa aja\n" +
      "🔍 Search internet (berita, fakta terkini)\n" +
      "📄 Baca & rangkum dokumen (kirim PDF/TXT)\n" +
      "🔗 Rangkum artikel (kirim link)\n" +
      "📝 Catet & inget sesuatu\n" +
      "⏰ Set reminder\n" +
      "🍽️ Cari restoran/tempat\n\n" +
      "Commands:\n" +
      "/clear - Reset percakapan\n" +
      "/ingatan - Liat yang Komo inget soal kamu\n" +
      "/lupakan - Reset ingatan Komo\n" +
      "/id - Lihat Telegram ID kamu" +
      (isAdmin(ctx.from.id)
        ? "\n\nAdmin:\n/pending - Lihat yang minta akses\n/add <id> - Whitelist user\n/remove <id> - Hapus user\n/list - Lihat whitelist"
        : "")
  );
});

// /clear
bot.command("clear", async (ctx) => {
  if (!(await isAllowed(ctx.from.id))) return;
  await clearHistory(ctx.from.id);
  ctx.reply("Percakapan di-reset. Mulai dari awal!");
});

// /id
bot.command("id", (ctx) => {
  ctx.reply(`Telegram ID kamu: ${ctx.from.id}`);
});

// /ingatan — lihat apa aja yang Komo inget tentang kamu
bot.command("ingatan", async (ctx) => {
  if (!(await isAllowed(ctx.from.id))) return denyAccess(ctx);
  const mems = await storage.getMemories(ctx.from.id.toString());
  if (mems.length === 0) return ctx.reply("Komo belum inget apa-apa soal kamu. Cerita dong! 🐱");
  ctx.reply("Yang Komo inget tentang kamu:\n" + mems.map((m) => `- ${m.text}`).join("\n"));
});

// /lupakan — hapus semua ingatan jangka panjang Komo tentang kamu
bot.command("lupakan", async (ctx) => {
  if (!(await isAllowed(ctx.from.id))) return denyAccess(ctx);
  await storage.clearMemories(ctx.from.id.toString());
  ctx.reply("Oke, Komo lupain semua yang gue tau tentang kamu. Fresh start! 🧼");
});

// /pending — lihat siapa aja yang udah nge-chat tapi belum di-whitelist
bot.command("pending", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const list = await storage.listPending();
  if (list.length === 0) return ctx.reply("Belum ada yang minta akses.");
  const lines = list.map(
    (p) => `- ${p.id}${p.name ? " (" + p.name + ")" : ""}${p.username ? " @" + p.username : ""}`
  );
  ctx.reply("Nunggu di-approve (whitelist pakai /add <id>):\n" + lines.join("\n"));
});

// /add
bot.command("add", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) return ctx.reply("Usage: /add <telegram_id>");
  const newId = Number(args[0]);
  if (!newId) return ctx.reply("ID harus angka.");
  await storage.addToWhitelist(newId);
  await storage.removePending(newId);
  ctx.reply(`User ${newId} berhasil di-whitelist! ✅`);
  // Kasih tau user-nya kalau udah di-approve (kalau mereka udah pernah start bot).
  try {
    await ctx.telegram.sendMessage(newId, "Yeay, kamu udah di-whitelist! Sekarang bisa chat Komo 🐱");
  } catch {}
});

// /remove
bot.command("remove", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) return ctx.reply("Usage: /remove <telegram_id>");
  const removeId = Number(args[0]);
  if (config.adminUserIds.includes(removeId)) return ctx.reply("Nggak bisa remove admin.");
  await storage.removeFromWhitelist(removeId);
  await clearHistory(removeId);
  ctx.reply(`User ${removeId} dihapus dari whitelist.`);
});

// /list
bot.command("list", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const whitelist = await storage.getWhitelist();
  const all = [...new Set([...config.allowedUserIds, ...whitelist])];
  if (all.length === 0) return ctx.reply("Whitelist kosong.");
  ctx.reply(
    "Whitelisted:\n" +
      all.map((id) => `- ${id}${config.allowedUserIds.includes(id) ? " (env)" : ""}`).join("\n")
  );
});

// Handle document uploads (PDF, TXT, etc.)
bot.on("document", async (ctx) => {
  if (!(await isAllowed(ctx.from.id))) return denyAccess(ctx);

  const doc = ctx.message.document;
  const fileName = doc.file_name || "file";
  const ext = path.extname(fileName).toLowerCase();

  if (![".pdf", ".txt", ".csv", ".json", ".md", ".html"].includes(ext)) {
    return ctx.reply("Komo bisa baca: PDF, TXT, CSV, JSON, MD, HTML. Format lain belum support ya.");
  }

  try {
    await ctx.sendChatAction("typing");
    ctx.reply("Bentar, Komo lagi baca dokumen kamu...");

    // Download file into memory (serverless filesystem is read-only).
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const buffer = await downloadToBuffer(fileLink.href);

    let textContent = "";
    if (ext === ".pdf") {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      textContent = data.text;
    } else {
      textContent = buffer.toString("utf-8");
    }

    // Truncate if too long
    if (textContent.length > 8000) {
      textContent = textContent.slice(0, 8000) + "\n\n[... dipotong, dokumen terlalu panjang]";
    }

    const caption = ctx.message.caption || "Rangkum dokumen ini";
    const message = `[User mengirim dokumen: ${fileName}]\n\nIsi dokumen:\n${textContent}\n\nPermintaan user: ${caption}`;

    const reply = await chat(ctx.from.id, message);

    if (reply.length > 4096) {
      for (let i = 0; i < reply.length; i += 4096) {
        await ctx.reply(reply.slice(i, i + 4096));
      }
    } else {
      await ctx.reply(reply);
    }
  } catch (err) {
    console.error("Document error:", err.message);
    ctx.reply("Waduh, gagal baca dokumen. Coba lagi ya.");
  }
});

// Handle photos (vision) — analisa gambar, baca struk, bagi tagihan, dll.
bot.on("photo", async (ctx) => {
  if (!(await isAllowed(ctx.from.id))) return denyAccess(ctx);

  try {
    await ctx.sendChatAction("typing");

    // Telegram kirim beberapa ukuran; ambil yang paling gede.
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const link = await ctx.telegram.getFileLink(largest.file_id);
    const buffer = await downloadToBuffer(link.href);

    const caption = ctx.message.caption || "";
    const reply = await chatWithImage(ctx.from.id, [buffer], caption);

    if (reply.length > 4096) {
      for (let i = 0; i < reply.length; i += 4096) {
        await ctx.reply(reply.slice(i, i + 4096));
      }
    } else {
      await ctx.reply(reply);
    }
  } catch (err) {
    console.error("Photo error:", err.message);
    ctx.reply("Waduh, gagal baca gambarnya. Coba kirim ulang atau fotonya yang lebih jelas ya.");
  }
});

// Handle text messages
bot.on("text", async (ctx) => {
  if (!(await isAllowed(ctx.from.id))) return denyAccess(ctx);

  try {
    await ctx.sendChatAction("typing");
    const reply = await chat(ctx.from.id, ctx.message.text);

    if (reply.length > 4096) {
      for (let i = 0; i < reply.length; i += 4096) {
        await ctx.reply(reply.slice(i, i + 4096));
      }
    } else {
      await ctx.reply(reply);
    }
  } catch (err) {
    console.error("Error:", err.message);
    ctx.reply("Waduh, ada error. Coba lagi ya.");
  }
});

// Helper: download file from URL into a Buffer (no disk writes).
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return downloadToBuffer(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

module.exports = bot;
