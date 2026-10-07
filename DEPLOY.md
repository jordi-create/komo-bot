# Deploy Komo Bot ke Vercel (gratis)

Bot ini jalan sebagai **webhook serverless** di Vercel. State (chat history, notes,
reminder) disimpan di **Upstash Redis** (gratis), dan reminder dicek tiap menit
oleh cron eksternal gratis (cron-job.org).

---

## 1. Bikin Upstash Redis (gratis)

1. Buka https://upstash.com → login.
2. **Create Database** → tipe **Redis** → region terdekat (mis. Singapore) → plan **Free**.
3. Di halaman database, scroll ke bagian **REST API**. Copy 2 nilai ini:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## 2. Deploy ke Vercel

```bash
npm i -g vercel
vercel login
cd "path/ke/telegram-ai-bot"
vercel            # deploy pertama (preview) — jawab prompt, biarkan default
```

Set semua environment variable (paling gampang lewat dashboard):
**vercel.com → project → Settings → Environment Variables**, tambahin:

| Key | Isi |
|-----|-----|
| `TELEGRAM_BOT_TOKEN` | token dari @BotFather |
| `GMI_API_KEY` | API key GMI Cloud |
| `ALLOWED_USER_IDS` | ID user yg boleh (pisah koma) |
| `ADMIN_USER_IDS` | ID admin |
| `UPSTASH_REDIS_REST_URL` | dari langkah 1 |
| `UPSTASH_REDIS_REST_TOKEN` | dari langkah 1 |
| `CRON_SECRET` | string acak bebas (mis. `komo-rahasia-123`) |
| `GOOGLE_PLACES_API_KEY` | opsional, boleh kosong |

Terus deploy production:

```bash
vercel --prod
```

Catat URL-nya, misal: `https://komo-bot.vercel.app`

## 3. Daftarin webhook ke Telegram (sekali aja)

Buka URL ini di browser (ganti `<TOKEN>` dan `<URL>`):

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.vercel.app/api/webhook
```

Harus muncul `{"ok":true,...}`.
Cek status: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

## 4. Setup cron reminder (cron-job.org, gratis)

1. Buka https://cron-job.org → daftar → **Create cronjob**.
2. URL: `https://<project>.vercel.app/api/cron?secret=<CRON_SECRET>`
3. Schedule: **every 1 minute**.
4. Save.

## 5. Tes

Chat botnya di Telegram. Kalau error, lihat log di
**Vercel → project → Deployments → (deployment) → Functions/Logs**.

---

## Catatan penting

- **Polling vs webhook:** begitu webhook aktif, `npm start` di lokal (polling) bakal
  error 409 conflict. Mau ngoding lokal lagi? Hapus webhook dulu:
  `https://api.telegram.org/bot<TOKEN>/deleteWebhook`, nanti pasang lagi buat prod.
- **Lokal butuh Upstash juga:** karena state pindah ke Redis, `.env` lokal harus ada
  `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (boleh pakai DB yang sama).
- **Reminder** meleset maksimal ~1 menit (karena cron per menit). Wajar.
- **Data lama** di `data/*.json` nggak keikut — sekarang semua di Redis.
- **Timeout:** balasan AI dibatasi 60 detik/pesan (limit Vercel Hobby). Cukup buat
  chat biasa; kalau tool call-nya banyak & lama bisa mepet.
- **Limit gratis:** Upstash free ~500k command/bulan, Vercel Hobby gratis — jauh
  lebih dari cukup buat bot personal.
```
