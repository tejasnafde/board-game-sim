# board-game-sim

Shared cross-project conventions (GCP accounts and the --configuration=personal
rule, OAuth consent branding, Secret Manager inventory, writing style) live in
`~/Desktop/projects/CLAUDE.local.md`. Read it before touching gcloud, OAuth, or
secrets.

@/Users/tejas/Desktop/projects/CLAUDE.local.md

Browser board-game simulator monorepo. Read `AGENTS.md` first — its architecture
rules (server-authoritative, intents-only clients, deterministic rule modules,
hidden info via `getPlayerView`) are non-negotiable and match the code.

## Commands

- `npm install` once, then:
- `npm run dev` — server (tsx) + web client (vite)
- `npm test` — vitest (contract + game + jsdom client tests)
- `npm run test:e2e` — Playwright browser smoke (boots server+vite, drives two
  players through join → play in a real browser). Uses system chromium at
  `/opt/homebrew/bin/chromium`; install skips the browser download.
- `npm run typecheck`

## Layout

- `packages/engine` — deterministic runtime: seq-gated actions, replay, integrity hashes
- `packages/server` — ws gateway + session service (in-memory only; restart loses games)
- `packages/shared` — contracts/types
- `packages/games/<game>` — `definition.json` (static data) + `src/rules/` (pure module)
- `packages/web-client` — hand-rolled DOM, full re-render per event, hash routing
- `documentation/` — keep in sync with contract changes (AGENTS.md rule)

## Adding a game — the playbook

This is the repeatable recipe. Connect4 (`packages/games/connect4/` +
`web-client/src/game-adapters/connect4/`) is the reference implementation —
copy its shape, don't invent a new one. Work IN THIS ORDER; each phase has a
gate, and skipping a gate is how broken games shipped before.

### Phase 1 — Rules + AI (no UI yet)

1. Game package `packages/games/<game>/`: `definition.json` (static config,
   playerCount min/max), `presentation.json`, rules module implementing
   `GameModule` (init / listLegalActions / applyAction / getPlayerView /
   isTerminal), and `src/bot.ts` exporting a `GameBot`.
2. The bot plays from ONLY the player view + definition — if it can't, the
   view is missing info humans need too. **AI quality bar** (test all three):
   - takes an immediately winning move (unit test)
   - blocks an opponent's immediately winning move (unit test)
   - move latency < ~500ms worst case — benchmark a full bot-vs-bot game with
     a throwaway tsx script BEFORE wiring anything (perfect play not required;
     "non-stupid + instant" beats "brilliant + 3s waits")
   - deterministic given the rng (replay + self-play stability)
   For turn-based perfect-information games, alpha-beta minimax with
   center-first ordering (see connect4 bot) is the house pattern; watch for the
   classic bugs: leaf-eval perspective sign, and root loop not narrowing alpha.
3. Aliases: add the package to `tsconfig.json` paths + `vitest.config.ts`.
4. Tests (per AGENTS.md): behavior, illegal-action rejection (out-of-bounds,
   not-your-turn, terminal-state), determinism (same moves → same hash).

### Phase 2 — Server wiring + self-play gate

5. Register: `server/src/game-registration.ts` + a row in the GAMES map in
   `server/src/realtime-gateway.ts` (version, seat range, bot, definition).
   The bot row powers "🤖 Play vs computer" automatically.
6. **Self-play gate**: one entry in `tests/e2e/self-play.test.ts` (bot,
   definition, rosters for min and max seats, action cap). Drives the real
   gateway to terminal; fails on deadlock, rejected bot actions, view crashes,
   non-termination. DO NOT touch UI until green.

### Phase 3 — Client adapter

7. Adapter dir `web-client/src/game-adapters/<game>/` (render / bind-events /
   selectors / types) + edits to `routes.ts`, `game-hub.ts`,
   `game-manifests/index.ts`, `browser-app.ts`. Game CSS lives in
   `web-client/app/index.html`'s style block.
8. **Fun checklist** — every item, non-negotiable (each one was a real
   complaint once):
   - whose-turn banner always visible; "waiting for <name>" uses real names
     (map seat ids through `state.seatNames`)
   - every action gives visible feedback within one state sync (disc appears,
     hit flashes, banner updates); the win moment is celebrated (overlay +
     winning cells highlighted)
   - rejected actions show a humanized reason (`humanizeError`) — a click that
     silently does nothing is a bug, not a style choice
   - impossible moves are visibly disabled, not just server-rejected
   - terminal screen has "Play Again" (`nextSessionId` rematch — all clickers
     land in the same fresh session) and "Back to Hub"
   - lobby offers "🤖 Play vs computer" (`vsBot: true` in lobbyPanelMarkup)
   - string-assert jsdom tests for the adapter (see connect4-adapter.test.ts)

### Phase 4 — Prove it with pixels

9. **Browser smoke**: spec in `tests/browser/games.spec.ts` — two players (or
   one + bot) join → play → assert feedback appeared. Routes are
   `/#/games/<game>` (plural). Kill stale dev servers first — Playwright
   reuses running ones and stale code causes ghost failures. Kill ONLY the
   listeners: `lsof -ti tcp:8080 -sTCP:LISTEN -ti tcp:5173 -sTCP:LISTEN | xargs kill`
   — a bare `lsof -ti :5173` also matches connected CLIENTS, i.e. the user's
   browser playing the game.
10. **Look at the screenshots.** The spec saves to `test-results/*.png`; open
    them. Check: hub card, lobby, mid-game with pieces, terminal screen.
    Green tests measure structure, not layout — oversized sprites and
    stretched pills shipped while everything was green. NO PLAYABILITY CLAIM
    WITHOUT PIXELS.

### The walk-away prompt

> Add <game> to board-game-sim following CLAUDE.md's "Adding a game" playbook
> exactly, phases in order, all gates green (`npm test`, `npm run test:e2e`,
> typecheck). Include a competent bot (win/block/latency tests). Finish by
> screenshotting hub/lobby/gameplay/terminal and reviewing them yourself.

Sessions: `session.create` accepts `players?: string[]` (exact roster — empty
seats deadlock), `seatCount?` (generic seats, claimed by name on join) and
`bots?: number` (server-played seats).

## Logging & debugging

Everything flows through `createLogger(namespace)` from `@board-game-sim/shared`
(levels: debug < info < warn < error < silent). Because the server is
authoritative, five namespaces cover every state change in the system:

- `[engine]` — every action: accepted (seq, actor, integrity hash) at info,
  payload + emitted domain events at debug, ALL rejections with reason at warn
- `[session]` — session create/recover
- `[gateway]` — seat claims ("tejas" claimed player-1), bot moves 🤖,
  session-full; a bot's move being rejected logs at ERROR (it means a game bug)
- `[ws]` — connections, per-event traffic, rejections, game-over lines
- `[client]` / `[controller]` — browser side: socket lifecycle + sends/recvs
  (debug), create/join decisions (info). Shows in the devtools console.

Controls:
- Server: `LOG_LEVEL=debug npm run dev:server` (default info; auto-warn under
  vitest so tests stay readable)
- Browser: append `?log=debug` to the URL (persists in localStorage as
  `bgs:log`) or `localStorage.setItem("bgs:log", "debug")`; reset with
  `?log=info`
- Tail the backend in its own terminal: run `npm run dev:server` and
  `npm run dev:web` separately instead of `npm run dev`

Rule: new modules log through `createLogger`, never bare `console.log`. Every
rejection path must log its reason — silent failures are how we got here.

## Known issues (don't rediscover)

- `client-controller.ts` / `grid-renderer.ts` are battleship-coupled despite generic names.
- Snapshot/replay persistence is in-memory-only; the recovery path is unreachable.
  Server restart / Cloud Run scale-to-zero loses all games.
- Protocol types are duplicated between `server/src/protocol.ts` and
  `web-client/src/realtime-client.ts` — change both or unify.
- playerId is unauthenticated free text; fine for friends, not for strangers.
  Upgrade path if ever needed: Google Sign-In via Supabase, verify the JWT in
  the gateway where `resolveSeat` claims seats. Do NOT build this speculatively.

## Deploy (friends-scale)

`npm run deploy` — runs the vitest gates, ships backend to Cloud Run and
frontend to Vercel. Config is explicit env vars, never gcloud/vercel
defaults: `BGS_GCP_PROJECT`, `BGS_GCP_REGION` and `BGS_GCP_ACCOUNT` are
required (`BGS_SERVICE`, `BGS_MIN_INSTANCES` optional).

```
BGS_GCP_PROJECT=teejayproject BGS_GCP_REGION=asia-south1 \
BGS_GCP_ACCOUNT=<personal gcloud email> npm run deploy
```

**Merging to `main` deploys.** `.github/workflows/deploy.yml` runs
`scripts/deploy.sh` on every push to `main`, so a merged PR ships backend and
frontend. It skips commits that only touch `documentation/**` or `*.md`. The
script runs `npm test` first, so a red suite blocks the deploy. Run
`npm run deploy` locally only to ship without merging.

CI authenticates with Workload Identity Federation (no key files); secrets
`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` and
`CLOUDFLARE_API_TOKEN` are already set on the repo.

RULE: every gcloud command — in scripts or ad hoc — passes `--account` and
`--project` explicitly (the personal config, e.g. project `teejayproject`).
The machine's ACTIVE gcloud config is a WORK account; forgetting the flags
deploys a hobby game into work infrastructure. `--account` is skipped when
`CI=true`, because WIF supplies exactly one credential and there is nothing to
choose. `--project` is required EVERYWHERE including CI: gcloud otherwise infers
it from the service account's email domain
(`...@developer.gserviceaccount.com`) and fails against a project named
`developer`.

- Backend: `gcloud run deploy --source .` (Dockerfile, tsx runtime, no compile
  step). **`--max-instances 1` is load-bearing**: sessions are in-memory; a
  second instance splits players into parallel universes. `--session-affinity`
  + `--timeout 3600` keep websockets alive; client auto-reconnects.
- `BGS_MIN_INSTANCES=0` (default) scales to zero — running games die on idle.
  Set 1 to keep games alive at ~always-on cost.
- Frontend: vite build with `VITE_WS_URL=wss://<run-url>/realtime` baked in,
  then `wrangler pages deploy` to Cloudflare Pages project `board-game-sim`
  (custom domain gaming.tn07.dev; wrangler is OAuth'd on this machine —
  see ~/Desktop/projects/CLAUDE.local.md for the Cloudflare identity/limits).
  **`--branch main` is mandatory**: wrangler picks the Pages environment from the
  current git branch, so without it a deploy from a feature branch publishes a
  preview alias while gaming.tn07.dev keeps serving the old build, and still
  reports success.
- New games need NO deploy changes — they ship inside the same two bundles;
  merge to `main`, or rerun `npm run deploy`.

## Before committing

Never commit without running `/deslop` and deleting essay-like comments.
Comments earn their place by explaining WHY; anything narrating WHAT the next
line does gets cut.

## Testing rules (from AGENTS.md)

New game modules need contract + behavior tests, illegal-action rejection tests,
and determinism checks.
