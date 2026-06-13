# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Production
npm run dev        # Development (node --watch auto-restarts on file changes)
```

No test runner, linter, or build step is configured.

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `CLAUDE_MODEL` | Defaults to `claude-haiku-4-5-20251001` |
| `OPERATOR_NAME` | Name shown when operator sends messages |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL connection (XAMPP default: root, no password) |
| `PORT` | HTTP port, defaults to 3000 |

The MySQL schema (`wa_sesiones`, `ciudadanos`, `conversaciones`, `mensajes`) is created automatically by `src/db/init.js` on every startup.

WhatsApp session credentials are persisted to `.baileys_auth/` (auto-created). Delete this folder to force a new QR scan. Media files (images, audio, video, documents) are saved to `public/media/`.

## Architecture

```
src/
  index.js              # Express + Socket.IO server, wires everything together
  bot/
    whatsapp.js         # Baileys WA connection, message ingestion, media download
    claude.js           # Two Claude calls: response generation + JSON classification
  store/
    conversations.js    # In-memory ConversationStore (EventEmitter, Map keyed by phone)
    seed.js             # Demo conversations loaded at startup
  routes/api.js         # REST API for the operator panel
  db/
    connection.js       # mysql2 connection pool
    init.js             # CREATE TABLE IF NOT EXISTS on startup
    service.js          # DB operations (upsert ciudadano/conversacion, save/update)
public/
  index.html            # Operator panel — single-file vanilla JS SPA, uses Socket.IO client
ejemplo.html            # Self-contained static demo (no server, hardcoded seed data)
```

### Message flow

1. WhatsApp message arrives → `whatsapp.js:handleIncoming`
2. Media is downloaded and saved to `public/media/`
3. Message is added to the in-memory `ConversationStore`
4. `store.emit('updated', conv)` → `index.js` re-broadcasts via `io.emit('conversation:updated', conv)` to all connected operator panels
5. Message and citizen are persisted to MySQL via `db/service.js`
6. If `agente === 'Sin asignar'` and message is text → `claude.js:generateBotResponse` replies via WA
7. For non-text media → a canned acknowledgement is sent
8. After bot reply → `claude.js:analyzeConversation` returns a JSON classification (`tipo`, `prioridad`, `delito`, `zona`, `aiConfidence`, `aiPuntos`, `recomendacion`) which updates both the store and the DB

### Claude API usage (`src/bot/claude.js`)

Two separate calls per incoming text message:

- **`generateBotResponse`** — uses `system` prompt + full conversation history as `messages[]`. Requires last message to be `role: user` (bot messages map to `assistant`).
- **`analyzeConversation`** — single `user` message with the transcript; expects the model to return a raw JSON object (no markdown). Parse errors are caught and return `null`.

### Conversation store

`ConversationStore` is a singleton (`module.exports = new ConversationStore()`). Key fields on each conversation object:

- `id` — folio string (`ORU-2026-XXXXX`), used as the primary DB key
- `phone` — WA phone number, the in-memory primary key
- `agente` — `'Sin asignar'` means bot is active; any other value suppresses bot replies
- `estado` — `'Nuevo' | 'En proceso' | 'Cerrado'`
- `messages[]` — `{ from: 'ciudadano'|'bot'|'agente'|'sistema', type, text, time, mediaUrl? }`

### API endpoints (`src/routes/api.js`)

| Method | Path | Action |
|---|---|---|
| GET | `/api/conversations` | All conversations sorted newest-first |
| GET | `/api/status` | WA connection status + QR data URL |
| POST | `/api/wa/reset` | Clear `.baileys_auth` and reconnect (new QR) |
| POST | `/api/conversations/:id/send` | Operator sends a message |
| POST | `/api/conversations/:id/tomar` | Operator claims a case |
| PATCH | `/api/conversations/:id` | Update `estado`, `agente`, `prioridad`, `tipo` |

All mutating endpoints broadcast `conversation:updated` via Socket.IO after DB write.

### Panel UI (`public/index.html`)

Single-file vanilla JS SPA. Connects via Socket.IO and listens for `conversation:updated`. On load it fetches `/api/conversations` and `/api/status`. WA QR display is handled through `whatsapp:qr` / `whatsapp:ready` Socket.IO events emitted to each newly connected socket (see `index.js` connection handler).
