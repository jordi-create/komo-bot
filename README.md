# Komo Bot: serverless LLM agent on Telegram

A personal assistant on Telegram, built as a tool-calling LLM agent. It runs as a
serverless webhook on Vercel and keeps its state in Upstash Redis, so hosting costs
nothing.

## What it can do
- **Hold a conversation with memory.** Chat history and long-term facts about the user persist across sessions.
- **Call 13 tools**, and the model decides when to use each one:
  - web search
  - fetch and read a URL
  - calculator
  - current date/time
  - notes: save, get, list, delete
  - remember a fact
  - reminders: set and list
  - nearby place search (Google Places)
  - image generation
- **Read files.** It reads uploaded PDF documents, and understands photos through a vision model.
- **Control access.** Only allowlisted users can chat. Admins add or remove users with `/add`, `/remove` and `/list`.
- **Send scheduled reminders.** An external cron calls a protected `/api/cron` endpoint every minute.

## Architecture
```
Telegram ──webhook──> api/webhook.js (Vercel serverless)
                         └─ src/bot.js      Telegraf handlers (text, photo, document, commands)
                         └─ src/ai.js       LLM loop: model ⇄ tool calls until final answer
                         └─ src/tools.js    tool schemas + implementations
                         └─ src/storage.js  history, notes, memory, reminders (Upstash Redis)
cron-job.org ──> api/cron.js ──> src/reminders.js (sends due reminders)
```

## Stack
Node.js · Telegraf · OpenAI-compatible SDK (DeepSeek via GMI Cloud, Gemini for vision) ·
Upstash Redis · Vercel serverless + cron · Tavily / DuckDuckGo search · Google Places · pdf-parse

## Run it
1. Copy `.env.example` to `.env` and fill in your keys.
2. Run `npm install`, then `npm run dev`. This uses long polling for local development.
3. To deploy, follow [DEPLOY.md](DEPLOY.md) (Vercel + Upstash + webhook + cron; written in Indonesian).
