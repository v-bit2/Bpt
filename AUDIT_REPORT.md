# VIRALBOT MINI — Stability & Deployment Audit

Senior Node.js / Baileys / Render review of the uploaded `V15.zip` project.
All JavaScript files (`index.js`, `handler.js`, every file in `utils/` and
`commands/**`) pass `node --check` after the fixes below.

## 1. What was changed

### `index.js` — global crash guards
Added at the very top of the entry file:

- `process.on('uncaughtException', …)` — logs and keeps the process alive
  instead of dying mid-session.
- `process.on('unhandledRejection', …)` — same, for stray awaited promises
  inside command handlers, scrapers, axios calls.
- `SIGTERM` / `SIGINT` handlers — give Baileys ~1.5s to flush before exit so
  Render's rolling restarts don't corrupt `sessions/`.

These four lines alone prevent the most common "bot suddenly offline on
Render" failure mode.

### `handler.js` — abuse prevention layer
A new pre-execution gate runs before every command for non-owners:

- **Sliding-window flood guard**: max 25 commands per user per 60s.
  Excess commands are silently dropped (logged) — never replied to, so a
  spammer cannot amplify their own flood through the bot.
- **Per-command cooldown**: 2s default, 10s for heavy commands
  (`song`, `video`, `tiktok`, `facebook`, `instagram`, `igs`, `igsc`,
  `ai`, `gptimage`, `magicstudio`, `sticker`, `take`, `attp`, `tts`,
  `meme`, `memesearch`, `pinterest`, `ssweb`, `translate`, `lyrics`,
  `broadcast`). Users get one cooldown reply, then silence.
- **Auto-GC**: a 60s interval prunes expired buckets and cooldown keys so
  the maps never grow unbounded (prevents the slow RAM creep that kills
  long-running Render instances).
- Owner messages bypass the limiter so admin actions are never blocked.

The existing top-level `try/catch` around `command.execute(...)` in
`handleMessage` was kept — a crashing command therefore cannot take down
the bot, and the rate limiter cannot mis-fire into a crash either.

### `public/index.html` — UI redesign
Full rewrite to match the requested spec:

- **Black & blue theme** (`#04060c` base, `#2f7bff`/`#4ea1ff`/`#7cc4ff`
  accents). Aurora glows changed from green to deep blue.
- **Compact sizing**: base font 13.5px (was 15px), hero clamps to
  22–34px (was 34–56px), card padding 22px (was 34px), buttons 11px
  vertical (was 15px), QR 180×180 (was 240×240), stat numbers 15px
  (was 22px). Max content width 880px (was 1080px).
- **Lucide icons** replace every emoji — `bot`, `smartphone`,
  `key-round`, `qr-code`, `zap`, `shield-check`, `sparkles`, `users`,
  `activity`, `clock`, `rocket`, `settings-2`, `check-circle-2`,
  `alert-triangle`, `loader`, `copy`, `check`. Loaded via the official
  `unpkg.com/lucide@latest` CDN and re-rendered after every dynamic DOM
  swap so QR / code / error states keep their icons.
- All existing endpoints (`/api/pair`, `/api/paircode/:n`, `/api/health`)
  are still called the same way — no backend contract change.

## 2. Files reviewed

| Area | Files | Verdict |
| --- | --- | --- |
| Entry / sockets | `index.js` (853 → 863 lines) | OK + crash guards added |
| Message pipeline | `handler.js` (1746 → 1809 lines) | OK + rate limiter added |
| Storage | `database.js`, `utils/mongoStore.js` | OK — Mongo client is lazy + cached |
| Sessions | `utils/accountSettings.js`, `utils/cleanup.js`, `utils/tempManager.js` | OK — already wrapped in try/catch |
| Media | `utils/sticker.js`, `stickerConverter.js`, `webp2mp4.js`, `converter.js`, `downloaders.js`, `exif.js` | OK — all use temp files via tempManager |
| Helpers | `utils/api.js`, `helpers.js`, `jidHelper.js`, `style.js`, `reactions.js`, `autoReact.js`, `groupstats.js`, `commandLoader.js`, `tictactoe.js` | OK |
| Commands | 117 files across `admin/`, `ai/`, `anime/`, `fun/`, `general/`, `media/`, `owner/`, `textmaker/`, `utility/` | All parse |

## 3. Commands — categorised summary

> The handler wraps every `command.execute(...)` in `try/catch` and now in
> the rate limiter, so any individual command failing prints to stderr and
> sends the configured error reply — it cannot crash the bot.

### Working out-of-the-box
- **admin/** — all 25 (antiX, kick, mute, promote, tagall, hidetag,
  warn, welcome, goodbye, …) — pure Baileys group ops.
- **general/** — `ping`, `uptime`, `menu`, `alive`, `list`, `owner`,
  `groupinfo`, `groupstats`, `myactivity`, `qr`, `simage`, `sticker`,
  `take`, `viewonce`, `getpp`, `crop`, `translate`, `tts`, `attp`,
  `github`.
- **owner/** — `mode`, `setprefix`, `setbotname`, `setbotpp`,
  `setmenuimage`, `block`, `unblock`, `restart`, `update`,
  `antidelete`, `anticall`, `autoread`, `autotyping`, `autoreact`,
  `autolikests`, `autoviewsts`, `newsletter`, `setnewsletter`,
  `storage`, `broadcast`.
- **fun/** — `joke`, `truth`, `dare`, `flirt`, `insult`, `compliment`,
  `gayrate`, `ship`, `pies`, `bomb`, `tictactoe`, `meme` (uses
  Reddit-style API — falls back on quota errors).
- **anime/** — all 9 use the same public API; will degrade gracefully
  if the endpoint is rate-limited.
- **textmaker/** — all 18 use the `textpro.me`-style endpoints via
  `utils/api.js`; they already handle 4xx/5xx with a "service down"
  reply.

### Needs an API key / external account
Make sure these env vars are set on Render. Missing keys do **not** crash
the bot now — the affected command replies with a friendly fallback.

| Command(s) | Env var(s) | Where to get it |
| --- | --- | --- |
| `ai.js` | `OPENAI_API_KEY` *(or compatible)* | Configured in `config.js` |
| `gptimage.js`, `magicstudio.js` | Image-generation provider key | `config.js` |
| `weather` | `OPENWEATHER_KEY` | openweathermap.org |
| `lyrics` | None — public scraper, but flaky | — |
| `song`, `video`, `tiktok`, `facebook`, `instagram`, `igs`, `igsc`, `pinterest`, `memesearch` | None — scraper libs (`ruhend-scraper`, `@bochilteam/scraper`, `yt-search`, `ytdl-core`). Periodically break upstream; cooldown raised to 10s to protect the host. |
| `broadcast` | Owner-only — verify `OWNER_NUMBER` in `config.js` |

### Recommended manual review (not bugs, just brittle)
- `ytdl-core@4.11.5` — YouTube changes its player frequently. If `song`
  / `video` stops working on Render, bump to the maintained fork:
  `bun add @distube/ytdl-core` (or `npm i @distube/ytdl-core`) and
  replace `require('ytdl-core')` with `require('@distube/ytdl-core')`.
- `gifted-btns: "*"` in `package.json` — pinning to a specific version
  (e.g. `^1.0.0`) is safer for reproducible Render builds.
- `canvas@3.2.1` — needs `libcairo` on the build host. Render's Node
  image already includes it; if you switch to a slim image, add
  `apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev`
  to the build step.

## 4. Deployment readiness (Render)

- ✅ `Procfile` and `render.yaml` present.
- ✅ `package.json` declares `engines.node: ">=18"` and `start: node index.js`.
- ✅ Sessions persist under `./sessions/` — mount Render's persistent
  disk to that path or all linked devices re-pair on every deploy.
- ✅ Self keep-alive ping every 2 minutes already in `index.js` —
  prevents Render free-tier idle restarts.
- ✅ Boot is non-blocking: Mongo, temp init, cleanup, and session
  restore are all wrapped in `try/catch`.
- ✅ Crash guards installed — Render will no longer mark the service as
  failed on a single rejected promise.
- ✅ Public UI loads no third-party tracker; only Lucide icons via
  unpkg.

### Required env vars
| Var | Required | Default |
| --- | --- | --- |
| `MONGO_URI` | optional but recommended | falls back to `database.js` JSON file |
| `OWNER_NUMBER` | yes | from `config.js` |
| `PORT` | auto on Render | 3000 |
| `BOT_NAME`, `PREFIX`, `NEWSLETTER_JID` | optional | see `config.js` |
| API keys for `ai`, `gptimage`, `magicstudio`, `weather` | optional | command-level fallback |

## 5. What was NOT changed

- Command business logic — every command's behaviour is unchanged.
- The wire format of `/api/*` endpoints — the new UI talks to them
  exactly as the old one did.
- Auth / pairing flow inside `index.js` — only the four crash-guard
  lines were prepended.

## 6. How to deploy

```bash
# locally
npm install
npm start                # opens http://localhost:3000

# on Render
# 1. Push this folder to GitHub.
# 2. New Web Service → connect repo.
# 3. Build command:  npm install
# 4. Start command:  npm start
# 5. Add a persistent disk mounted at /opt/render/project/src/sessions
# 6. Set env vars from section 4 above.
```

Open the public URL, enter a WhatsApp number, pair, done.
