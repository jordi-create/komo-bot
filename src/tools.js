const storage = require("./storage");
const config = require("./config");

let _imageCallback = null;
function setImageCallback(cb) {
  _imageCallback = cb;
}

const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Cari informasi terbaru di internet. Gunakan kalau ditanya event terkini, berita, harga, fakta yang mungkin berubah, atau hal yang nggak yakin jawabannya.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_datetime",
      description: "Dapatkan tanggal dan waktu sekarang (WIB)",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Hitung ekspresi matematika/aritmatika dengan akurat. WAJIB dipakai buat itung-itungan angka (tambah, kurang, kali, bagi, persen, kurung) — jangan ngitung di kepala biar nggak salah.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "Ekspresi matematika pakai angka & operator + - * / % ( ). Contoh: '(25000+8000)*1.1' atau '106382822928337/29263683'",
          },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description:
        "Buka dan baca isi halaman web/artikel dari URL. Gunakan kalau user kirim link dan minta dirangkum atau dianalisis.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL halaman web yang mau dibaca" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_note",
      description:
        "Simpan catatan untuk user. Gunakan kalau user bilang 'catet', 'simpan', 'inget ini', dll.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Judul/label pendek untuk catatan (lowercase, no spaces, pakai dash)" },
          content: { type: "string", description: "Isi catatan yang mau disimpan" },
        },
        required: ["key", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_note",
      description: "Ambil catatan yang sudah disimpan berdasarkan key.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Key/label catatan" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "Lihat semua catatan yang tersimpan untuk user ini.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "Hapus catatan berdasarkan key.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Key/label catatan yang mau dihapus" },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_fact",
      description:
        "Simpan fakta penting & tahan lama tentang user ke ingatan jangka panjang (nama, panggilan, preferensi/suka-gak suka, pekerjaan, hobi, orang/hal penting, tanggal penting). Panggil ini SETIAP KALI user ngasih info personal yang berguna diinget di chat-chat berikutnya. JANGAN buat hal sepele atau info sementara.",
      parameters: {
        type: "object",
        properties: {
          fact: {
            type: "string",
            description:
              "Fakta ringkas & jelas buat diinget. Contoh: 'Nama user Jordi', 'User suka kopi tanpa gula', 'User kerja sebagai desainer', 'User alergi seafood'.",
          },
        },
        required: ["fact"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_reminder",
      description:
        "Set reminder/pengingat. Bot akan kirim pesan ke user setelah waktu yang ditentukan. Gunakan kalau user bilang 'ingetin', 'remind me', 'alarm', dll.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Isi reminder, misal 'meeting jam 3'" },
          minutes: { type: "number", description: "Berapa menit dari sekarang reminder mau bunyi" },
        },
        required: ["label", "minutes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "Lihat semua reminder aktif.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_places",
      description:
        "Cari restoran, cafe, atau tempat menarik berdasarkan query dan lokasi. Gunakan kalau user minta cari tempat makan, restoran, cafe, dll.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Jenis tempat yang dicari, misal 'restoran jepang', 'cafe hits'" },
          location: { type: "string", description: "Lokasi/area pencarian, misal 'Senopati Jakarta', 'Kemang'" },
        },
        required: ["query", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate gambar dari deskripsi teks. Gunakan kalau user minta bikin gambar, ilustrasi, foto, desain, meme, atau visual apapun. Tulis prompt dalam bahasa Inggris untuk hasil terbaik.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Deskripsi gambar yang mau di-generate, HARUS dalam bahasa Inggris untuk kualitas terbaik" },
          width: { type: "number", description: "Lebar gambar (default 1024)" },
          height: { type: "number", description: "Tinggi gambar (default 1024)" },
        },
        required: ["prompt"],
      },
    },
  },
];

async function executeFunction(name, args, userId) {
  switch (name) {
    case "web_search":
      return await webSearch(args.query);
    case "get_current_datetime":
      return getCurrentDatetime();
    case "calculate":
      return calculate(args.expression);
    case "fetch_url":
      return await fetchUrl(args.url);
    case "save_note":
      return await saveNote(userId, args.key, args.content);
    case "get_note":
      return await getNote(userId, args.key);
    case "list_notes":
      return await listNotes(userId);
    case "delete_note":
      return await deleteNote(userId, args.key);
    case "remember_fact":
      return await rememberFact(userId, args.fact);
    case "set_reminder":
      return await setReminderTool(userId, args.label, args.minutes);
    case "list_reminders":
      return await listRemindersTool(userId);
    case "search_places":
      return await searchPlaces(args.query, args.location);
    case "generate_image":
      return await generateImage(userId, args.prompt, args.width, args.height);
    default:
      return { error: "Function not found" };
  }
}

// === WEB SEARCH ===

async function webSearch(query) {
  // Urutan provider: Tavily (utama) -> Google CSE (opsional) -> DuckDuckGo (cadangan).
  // Tiap provider balikin { results } kalau sukses, atau { error } kalau gagal.

  // 1. Tavily — search API buat bot AI (paling reliable, hasil udah rapi)
  if (config.tavilyApiKey) {
    const r = await tavilySearch(query);
    if (r.results) return r;
  }

  // 2. Google Custom Search — cuma kepake kalau di-set (di akun org ini keblokir)
  if (config.googleSearchApiKey && config.googleSearchCx) {
    const r = await googleCseSearch(query);
    if (r.results) return r;
  }

  // 3. DuckDuckGo — cadangan terakhir (gratis, tanpa key)
  return await duckDuckGoSearch(query);
}

async function tavilySearch(query) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.tavilyApiKey}`,
      },
      body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Tavily error:", res.status, body.slice(0, 200));
      return { error: `Tavily HTTP ${res.status}` };
    }

    const data = await res.json();
    const results = (data.results || []).slice(0, 5).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || "").slice(0, 300),
    }));
    return results.length > 0 ? { results } : { error: "Tavily: tidak ada hasil." };
  } catch (err) {
    console.error("Tavily gagal:", err.message);
    return { error: "Tavily gagal: " + err.message };
  }
}

async function googleCseSearch(query) {
  try {
    const url =
      `https://www.googleapis.com/customsearch/v1` +
      `?key=${config.googleSearchApiKey}` +
      `&cx=${config.googleSearchCx}` +
      `&q=${encodeURIComponent(query)}` +
      `&num=5&hl=id&gl=id`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();

    if (data.error) {
      console.error("Google CSE error:", data.error.message);
      return { error: data.error.message };
    }

    const results = (data.items || []).slice(0, 5).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet || "",
    }));
    return results.length > 0 ? { results } : { error: "Google CSE: tidak ada hasil." };
  } catch (err) {
    console.error("Google CSE gagal:", err.message);
    return { error: "Google CSE gagal: " + err.message };
  }
}

async function duckDuckGoSearch(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://lite.duckduckgo.com/lite/?q=${encoded}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await res.text();

    const results = [];
    const linkRegex = /<a rel="nofollow" href="(.*?)" class='result-link'>(.*?)<\/a>/g;
    const snippetRegex = /<td class="result-snippet">([\s\S]*?)<\/td>/g;

    const links = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      links.push({ url: m[1], title: m[2].replace(/<[^>]*>/g, "") });
    }

    const snippets = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]*>/g, "").trim());
    }

    for (let i = 0; i < Math.min(links.length, 5); i++) {
      results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || "" });
    }

    if (results.length === 0) {
      const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      return { results: "Raw: " + text.slice(0, 1000) };
    }
    return { results };
  } catch (err) {
    try {
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
      const data = await res.json();
      const results = [];
      if (data.Abstract) results.push({ title: data.Heading, snippet: data.Abstract, url: data.AbstractURL });
      if (data.RelatedTopics) {
        for (const t of data.RelatedTopics.slice(0, 5)) {
          if (t.Text) results.push({ title: t.Text.slice(0, 80), snippet: t.Text, url: t.FirstURL });
        }
      }
      return results.length > 0 ? { results } : { error: "Tidak ada hasil." };
    } catch {
      return { error: "Search gagal: " + err.message };
    }
  }
}

// === FETCH URL ===

async function fetchUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    let html = await res.text();

    // Strip scripts, styles, and tags
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to ~4000 chars to save tokens
    return { content: html.slice(0, 4000), url, note: html.length > 4000 ? "Konten dipotong (terlalu panjang)" : undefined };
  } catch (err) {
    return { error: "Gagal buka URL: " + err.message };
  }
}

// === NOTES ===

async function saveNote(userId, key, content) {
  await storage.saveNote(userId.toString(), key, content);
  return { success: true, message: `Catatan "${key}" tersimpan.` };
}

async function getNote(userId, key) {
  const note = await storage.getNote(userId.toString(), key);
  if (!note) return { error: `Catatan "${key}" nggak ditemukan.` };
  return { key, content: note.content, savedAt: note.savedAt };
}

async function listNotes(userId) {
  const notes = await storage.listNotes(userId.toString());
  if (notes.length === 0) return { message: "Belum ada catatan tersimpan." };
  return { notes };
}

async function deleteNote(userId, key) {
  const ok = await storage.deleteNote(userId.toString(), key);
  return ok ? { success: true, message: `Catatan "${key}" dihapus.` } : { error: `Catatan "${key}" nggak ditemukan.` };
}

// === LONG-TERM MEMORY ===

async function rememberFact(userId, fact) {
  await storage.addMemory(userId.toString(), fact);
  return { success: true, message: `Oke, Komo inget ini ya: "${fact}"` };
}

// === REMINDERS ===

async function setReminderTool(userId, label, minutes) {
  if (minutes <= 0 || minutes > 1440) {
    return { error: "Reminder harus antara 1 menit sampai 24 jam (1440 menit)." };
  }
  const result = await storage.addReminder(userId, label, minutes * 60 * 1000);
  return { success: true, message: `Reminder "${label}" di-set ${minutes} menit dari sekarang.`, fireAt: result.fireAt };
}

async function listRemindersTool(userId) {
  const reminders = await storage.listReminders(userId);
  if (reminders.length === 0) return { message: "Nggak ada reminder aktif." };
  return { reminders };
}

// === PLACES SEARCH ===

async function searchPlaces(query, location) {
  const apiKey = config.googlePlacesApiKey;

  if (apiKey) {
    try {
      const textQuery = `${query} di ${location}`;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(textQuery)}&language=id&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== "OK" || !data.results?.length) {
        return { error: "Tidak ditemukan tempat. Coba kata kunci lain." };
      }

      const places = data.results.slice(0, 5).map((p) => ({
        name: p.name,
        address: p.formatted_address,
        rating: p.rating || "N/A",
        total_reviews: p.user_ratings_total || 0,
        open_now: p.opening_hours?.open_now ?? "unknown",
        price_level: p.price_level ? "$".repeat(p.price_level) : "N/A",
        maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
      }));

      return { places };
    } catch (err) {
      return { error: "Google Places error: " + err.message };
    }
  }

  // Fallback: web search
  const searchQuery = `${query} di ${location} terbaik rating review`;
  return await webSearch(searchQuery);
}

// === IMAGE GENERATION ===

async function generateImage(userId, prompt, width = 1024, height = 1024) {
  // Try GMI Cloud first (uses same $20 credit)
  try {
    const res = await fetch(`${config.gmiBaseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.gmiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-lite-image",
        prompt: prompt,
        n: 1,
        size: `${Math.min(width || 1024, 1024)}x${Math.min(height || 1024, 1024)}`,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (res.ok) {
      const data = await res.json();
      const imageData = data.data?.[0];

      if (imageData) {
        const imgSource = imageData.url || imageData.b64_json;
        if (_imageCallback) {
          _imageCallback(userId, imgSource, prompt, !!imageData.b64_json);
        }
        return { success: true, message: "Gambar berhasil di-generate via GMI Cloud dan dikirim!", prompt };
      }
    }

    // If GMI fails, log and try fallback
    const errText = await res.text().catch(() => "unknown");
    console.log("GMI image failed:", res.status, errText.slice(0, 200));
  } catch (err) {
    console.log("GMI image error:", err.message);
  }

  // Fallback: Pollinations (free, no API key)
  try {
    const w = Math.min(width || 1024, 1024);
    const h = Math.min(height || 1024, 1024);
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true`;

    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return { error: "Gagal generate gambar." };

    if (_imageCallback) {
      _imageCallback(userId, imageUrl, prompt, false);
    }
    return { success: true, message: "Gambar berhasil di-generate (Pollinations fallback) dan dikirim!", prompt };
  } catch (err) {
    return { error: "Gagal generate gambar: " + err.message };
  }
}

// === CALCULATOR ===

function calculate(expression) {
  const expr = String(expression || "").trim();
  // Whitelist: digits, operators, parentheses, dot, whitespace only. This makes
  // it safe to evaluate (no identifiers, no function calls, no code).
  if (!expr || !/^[0-9+\-*/%.()\s]+$/.test(expr)) {
    return { error: "Cuma bisa itung angka & operator + - * / % ( ) ya." };
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + expr + ");")();
    if (typeof result !== "number" || !isFinite(result)) {
      return { error: "Hasilnya nggak valid (mungkin ada pembagian dengan nol)." };
    }
    return { expression: expr, result };
  } catch (e) {
    return { error: "Gagal ngitung: " + e.message };
  }
}

// === DATETIME ===

function getCurrentDatetime() {
  const now = new Date();
  return {
    date: now.toLocaleDateString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jakarta",
    }),
    time: now.toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta",
    }),
    timezone: "WIB",
  };
}

module.exports = { toolDefinitions, executeFunction, setImageCallback };
