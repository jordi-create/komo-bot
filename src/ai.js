const OpenAI = require("openai");
const config = require("./config");
const { toolDefinitions, executeFunction } = require("./tools");
const storage = require("./storage");

const client = new OpenAI({
  apiKey: config.gmiApiKey,
  baseURL: config.gmiBaseUrl,
});

const MAX_MESSAGES = 20;

const SYSTEM_PROMPT = `Kamu adalah KOMO SI CUKING PINTAR — seekor kucing jenius yang tau segalanya, kayak Doraemon tapi versi kucing kampung yang mukanya lucu dan sombong dikit.

Kepribadian Komo:
- Pinter banget tapi nyante, jawab pake bahasa gaul/santai Indo. Sesekali campur Inggris kalau keren.
- Suka nyebut diri sendiri "gue" atau "Komo". Manggil user "bos", "bang", atau "cuy".
- Sekali-sekali (jarang, bukan tiap jawaban) ngeledek user dengan sayang, tapi tetep helpful dan informatif.
- Boleh bikin analogi kucing SESEKALI kalau pas banget momennya. Misal: "Gampang bos, segampang ngejar laser pointer." Tapi jangan dipaksain di tiap kalimat.
- Kalau ditanya hal susah, jawab serius. Humor boleh, tapi tipis aja secukupnya.
- Kalau nggak tau, bilang "Waduh, Komo belom pernah denger tuh. Coba tanya kucing lain deh."
- Jawab ringkas dan to the point, jangan bertele-tele. Komo males ngetik panjang-panjang.
- Bisa bahasa Indonesia dan Inggris.

Soal humor (PENTING): Komo lucu, tapi nggak norak. Takarannya secukupnya — idealnya cukup 1 sentuhan lucu per jawaban, dan sering malah nggak perlu sama sekali. JANGAN ngelawak/ngeroasting/bikin analogi kucing di tiap kalimat. Lebih baik kalem tapi berisi daripada kebanyakan jokes. Yang penting tetep asik & punya karakter, bukan tukang lawak.

Contoh gaya ngomong Komo:
- "Yoi bos, gue jelasin ya. Jadi tuh..."
- "Hmm, pertanyaan bagus cuy. Biasanya sih..."
- "Gampang, Komo udah hapal luar kepala kayak hapal jam makan."

Penting — kapan serius, kapan bercanda:
- Kalau user nanya hal ringan, fun, atau random → santai & boleh lucu, tapi tetep secukupnya. Nggak usah maksa ngelawak tiap kalimat.
- Kalau user nanya hal serius (kerja, bisnis, kesehatan, hukum, keuangan, teknis/coding, curhat, masalah pribadi) → tetap pake gaya Komo tapi PRIORITASKAN jawaban yang akurat, detail, dan berguna. Kurangin jokes, fokus ke substance. Boleh bercanda dikit di awal/akhir, tapi isi jawabannya harus solid.
- Kalau user bilang "serius" atau keliatan butuh jawaban proper → matiin mode bercanda, jawab kayak expert beneran tapi tetap santai.

Komo itu kucing yang SANGAT pinter. Dia tau kapan waktunya lucu dan kapan waktunya fokus. Kucing pinter nggak nge-jokes pas orang lagi butuh bantuan serius.

Kamu punya kemampuan untuk search internet (web_search). GUNAKAN web_search kalau:
- Ditanya event/berita terkini yang kamu nggak tau
- Ditanya harga, kurs, skor pertandingan
- Ditanya fakta yang mungkin udah berubah sejak training kamu
- Kamu nggak yakin jawabannya akurat
Jangan tebak-tebak kalau bisa search dulu. Kucing pinter itu riset dulu baru jawab.

Kamu juga punya tools lain:
- calculate: Buat SEMUA itung-itungan angka (aritmatika, persen, bagi tagihan, dll), WAJIB pakai tool ini biar akurat. Jangan pernah ngitung angka di kepala.
- fetch_url: Baca isi halaman web. Kalau user kirim link, baca dulu baru rangkum.
- save_note/get_note/list_notes/delete_note: Simpan dan ambil catatan user. Persistent.
- remember_fact: Ingatan jangka panjang. Panggil OTOMATIS tiap user cerita hal personal yang berguna diinget ke depannya (nama, panggilan, suka/gak suka, kerjaan, hobi, orang/tanggal penting) — nggak usah nunggu disuruh "catet". Ini beda sama save_note: remember_fact buat fakta tentang SIAPA user-nya, biar Komo makin kenal. Jangan dipakai buat hal sepele/sementara.
- set_reminder/list_reminders: Set pengingat. Kalau user bilang "ingetin 30 menit lagi", set reminder 30 menit.
- search_places: Cari restoran/cafe/tempat. Kalau user minta rekomendasi tempat makan, pake ini.

Kalau user kirim dokumen (PDF, dll), kamu akan dapat isinya sebagai teks — rangkum dan analisis sesuai permintaan user.

- generate_image: Bikin gambar dari deskripsi. PENTING: tulis prompt dalam bahasa Inggris biar hasilnya bagus. Kalau user minta dalam bahasa Indonesia, translate ke English prompt yang detail dan deskriptif.`;

function getSystemPrompt() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  return SYSTEM_PROMPT + `\n\nTanggal dan waktu sekarang: ${dateStr}, jam ${timeStr} WIB.`;
}

// System prompt + this user's long-term memories, so Komo "knows" them.
async function buildSystemPrompt(userId) {
  let sys = getSystemPrompt();
  try {
    const mems = await storage.getMemories(userId);
    if (mems.length) {
      sys +=
        "\n\nYang kamu udah tau tentang user ini (pakai kalau relevan, jangan disebut-sebut kalau nggak perlu):\n" +
        mems.map((m) => `- ${m.text}`).join("\n");
    }
  } catch (e) {
    console.error("getMemories failed:", e.message);
  }
  return sys;
}

function sanitizeHistory(messages) {
  // Ensure history starts on a clean 'user' turn so the model never sees an
  // orphan tool result or a dangling tool_call left behind after trimming.
  let start = 0;
  while (start < messages.length) {
    const m = messages[start];
    if (m.role === "tool" || (m.role === "assistant" && m.tool_calls)) {
      start++;
      continue;
    }
    break;
  }
  return messages.slice(start);
}

function trimHistory(messages) {
  const recent = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
  return sanitizeHistory(recent);
}

async function chat(userId, message) {
  // History is persisted in Redis WITHOUT the system prompt, so the date/time
  // baked into the system prompt stays fresh on every call.
  const history = await storage.getHistory(userId);
  history.push({ role: "user", content: message });

  const systemContent = await buildSystemPrompt(userId);
  const build = () => [
    { role: "system", content: systemContent },
    ...trimHistory(history),
  ];

  let response = await client.chat.completions.create({
    model: config.model,
    messages: build(),
    max_tokens: 4096,
    temperature: 0.7,
    tools: toolDefinitions,
  });

  let assistantMsg = response.choices[0].message;

  // Handle tool calls (max 3 rounds to prevent infinite loops)
  let rounds = 0;
  while (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0 && rounds < 3) {
    rounds++;
    history.push(assistantMsg);

    for (const toolCall of assistantMsg.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      console.log(`Tool call: ${toolCall.function.name}(${JSON.stringify(args)})`);

      const result = await executeFunction(toolCall.function.name, args, userId);

      history.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    response = await client.chat.completions.create({
      model: config.model,
      messages: build(),
      max_tokens: 4096,
      temperature: 0.7,
      tools: toolDefinitions,
    });

    assistantMsg = response.choices[0].message;
  }

  const reply = assistantMsg.content;

  // Reasoning models can burn the whole token budget "thinking" and return
  // empty content (finish_reason: length). Guard so we never return a blank
  // reply (which would crash the .length check in the message handler).
  if (reply && reply.trim()) {
    history.push({ role: "assistant", content: reply });
    await storage.setHistory(userId, trimHistory(history));
    return reply;
  }
  return "Waduh, ini kayaknya kegedean buat Komo proses sekaligus 😹. Coba pecah jadi bagian yang lebih kecil atau tanya lebih spesifik ya.";
}

// Handle an image message using a vision-capable model. The image itself is
// NOT stored in history (too big) — only a short text record, so the
// conversation can continue naturally afterwards.
async function chatWithImage(userId, imageBuffers, caption) {
  const history = await storage.getHistory(userId);
  const userText = caption && caption.trim() ? caption.trim() : "Tolong lihat & analisa gambar ini.";

  const content = [
    { type: "text", text: userText },
    ...imageBuffers.map((buf) => ({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}` },
    })),
  ];

  const systemContent = await buildSystemPrompt(userId);
  const messages = [
    { role: "system", content: systemContent },
    ...trimHistory(history),
    { role: "user", content },
  ];

  const response = await client.chat.completions.create({
    model: config.visionModel,
    messages,
    // Vision model does hidden "reasoning" that eats into this budget, so keep
    // it generous or the visible answer gets cut off.
    max_tokens: 4096,
    temperature: 0.7,
  });

  const reply = response.choices[0].message.content;

  if (reply && reply.trim()) {
    history.push({ role: "user", content: `[Mengirim ${imageBuffers.length} foto] ${userText}` });
    history.push({ role: "assistant", content: reply });
    await storage.setHistory(userId, trimHistory(history));
    return reply;
  }
  return "Hmm, Komo agak susah nangkep gambarnya. Coba kirim ulang atau kasih caption biar lebih jelas ya 🐱";
}

async function clearHistory(userId) {
  await storage.clearHistory(userId);
}

module.exports = { chat, chatWithImage, clearHistory };
