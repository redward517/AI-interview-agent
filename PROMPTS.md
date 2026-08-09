# Prompt Log

A running record of meaningful work in this project and the prompt that produced it.

---

## Entry 1 — Interview system prompt builder

**Built:** [`lib/systemPrompt.ts`](lib/systemPrompt.ts) — exports `buildSystemPrompt(candidate, curriculumDays)`, which renders the ABTalks AI Cohort technical-interview system prompt, injecting the candidate's name/role/mission history and the target curriculum days into the fixed rules/output-format template.

**Prompt:**
> Now: create lib/systemPrompt.ts exporting a function buildSystemPrompt(candidate,
> curriculumDays) that returns this text, with candidate and curriculumDays data
> injected where marked: [ABTalks AI Cohort interviewer system prompt — candidate
> profile, mission history, curriculum focus days, interview rules, and strict
> JSON output format]

---

## Entry 2 — Model provider selector

**Built:** [`lib/model.ts`](lib/model.ts) — exports `getModel()`, which reads `MODEL_PROVIDER` (`"anthropic"` or `"groq"`) and returns `claude-sonnet-5` via `@ai-sdk/anthropic` or `llama-3.3-70b-versatile` via `@ai-sdk/groq`. Installed `ai`, `@ai-sdk/anthropic`, `@ai-sdk/groq`, and added `ANTHROPIC_API_KEY` / `GROQ_API_KEY` / `MODEL_PROVIDER` to `.env.local` (gitignored).

**Prompt:**
> Also create lib/model.ts exporting getModel(), which reads a MODEL_PROVIDER env
> var ("anthropic" or "groq") and returns the right model object: claude-sonnet-5
> via @ai-sdk/anthropic, or llama-3.3-70b-versatile via @ai-sdk/groq (adjust the
> exact Groq model id if that one errors — use whichever current Llama 3.3 70B id
> their SDK docs specify). Install @ai-sdk/anthropic, @ai-sdk/groq, and ai if not
> already present. Add ANTHROPIC_API_KEY, GROQ_API_KEY, and MODEL_PROVIDER=anthropic
> to .env.local.

---

## Entry 3 — Fix Mission type to match real candidate data

**Built:** Made `passed`, `attempts`, and `skipped` optional on the `Mission` interface in [`lib/systemPrompt.ts`](lib/systemPrompt.ts) (with safe fallbacks when rendering mission history into the prompt). The real `candidates.json` sample data omits `passed`/`attempts` on skipped missions (e.g. `{ "day": 29, "title": "...", "skipped": true }`), which didn't fit the original required-fields shape.

**Prompt:**
> (Follow-up correctness fix made while building the `/api/interview` route below, after inspecting the real candidate data schema.)

---

## Entry 4 — POST /api/interview endpoint

**Built:** [`app/api/interview/route.ts`](app/api/interview/route.ts) — the interview conversation endpoint. A `candidate`-only body starts a session: it selects up to 6 curriculum days from [`data/curriculum.json`](data/curriculum.json) (prioritizing days the candidate skipped or needed multiple attempts on, then untouched days, then the rest, as a fallback so the model always has enough days to work with), builds the system prompt, and asks the model to greet the candidate and ask its first question. A body with `message` + `history` + `progress` (+ `candidate`, resent each turn since the endpoint holds no server-side session state) continues the conversation, appends to history, calls the model, and enforces the 10-question/4-day completion gate server-side — if the model tries to end early it's nudged (up to 2 retries) to keep going instead. Also added `data/curriculum.json` (copied from the provided curriculum data) and a `launch.json` dev-server config for local preview.

**Prompt:**
> Build POST /api/interview at app/api/interview/route.ts: 1. If the request body
> has a candidate field and no message, this starts a new session: pick up to 6
> curriculum days from curriculum.json, prioritizing any days in candidate.missions
> that were skipped or took multiple attempts, filling remaining slots with untouched
> days. Build the system prompt via buildSystemPrompt, call the model asking it to
> greet the candidate and ask the first question. Return {reply, done: false, history:
> [the reply added to a fresh array], progress: {questionsAsked: 1, daysCovered:
> [currentDay]}}. 2. If the body has message, history, and progress, this is a
> continuing turn: append the new message to history, call the model with the system
> prompt plus full history, parse its JSON reply. Increment progress.questionsAsked,
> add currentDay to progress.daysCovered as a unique set. Only allow done: true if
> questionsAsked >= 10 AND daysCovered has 4+ unique days — if the model tries to end
> early, override done to false and prompt it to continue. Return exactly {reply, done,
> feedback (only when done), history, progress} — 'reply', 'done', and 'feedback' must
> match technical-spec.md exactly since that's what's graded; history and progress are
> extra fields we need for state.

---

## Entry 5 — /api/interview smoke test script

**Built:** [`scripts/test-interview.mjs`](scripts/test-interview.mjs) — a standalone Node script (`npm run test:interview`) that starts a session against a running dev server, validates the response shape (`reply`/`done`/`history`/`progress`), sends one simulated candidate reply, and validates the continuing-turn response too, including the `feedback` shape if `done: true`. Ran it against the live dev server with a real Anthropic response to confirm the endpoint actually works end-to-end before building any UI on top of it.

**Prompt:**
> After this is built, write a small test script (or use curl) that simulates
> starting a session and sending one reply, so we can confirm it actually returns
> valid JSON with a real model response before we build the UI on top of it.

---

## Entry 6 — Copy candidates.json into data/

**Built:** [`data/candidates.json`](data/candidates.json) — copied from the provided candidates file into the project, matching how `data/curriculum.json` was set up, so `app/page.tsx` can populate the candidate picker.

**Prompt:**
> First, locate candidates.json (check Downloads, same place curriculum.json was
> found) and copy it into data/candidates.json, matching how curriculum.json is set up.

---

## Entry 7 — Interview page UI (chat, progress, report card)

**Built:** [`app/page.tsx`](app/page.tsx) — the main interview page. A candidate dropdown starts a session against `/api/interview` on selection; a chat log renders alternating candidate/interviewer bubbles that fade+slide in with Framer Motion; a live "Questions X/10" / "Days covered Y/4" progress bar animates its fill width; on `done: true` the input is replaced by an animated report card (summary, strengths, gaps, next steps). A fixed, slowly drifting blurred gradient glow sits behind everything for the dark/premium look. Installed `framer-motion` (the task said it was already installed — it wasn't, so added it). Verified the full flow live in the browser (see Entry 8 for the two real bugs this surfaced and fixed).

**Prompt:**
> Then build the main page (app/page.tsx): [dropdown candidate picker posting to
> /api/interview with sessionId+candidate; chat interface with text input/send
> button posting {sessionId, message, history, progress} and updating from the
> reply; live progress indicator "Questions: X/10" / "Days covered: Y/4"; on
> done:true replace the input with a report card showing feedback.summary,
> strengths, gaps, next]. Style with Tailwind + Framer Motion only (no
> Three.js/WebGL/canvas): dark near-black spacious layout, one accent color used
> sparingly, chat bubbles fade+slide in, a soft drifting/pulsing blurred gradient
> background, animated progress bar fill, and a fade+scale reveal for the final
> report card. Test it by actually running through a mock interview in the
> browser before committing.

---

## Entry 8 — Fix two real bugs found while testing in the browser

**Built:** Two fixes to [`app/api/interview/route.ts`](app/api/interview/route.ts), both found by actually running interviews in the browser (not just curl), as instructed:
1. The model occasionally broke the JSON-only output rule mid-conversation and returned plain prose instead — `extractJson` now falls back to pulling the first `{...}` block out of prose, and `callModel` retries with a corrective nudge (up to 2 times, not persisted into the visible history) before giving up.
2. That retry path could echo an empty-string model reply back into the next API call, which Anthropic's API rejects outright (`messages: text content blocks must be non-empty`, a real 400 hit live). Added a `nonEmpty()` guard applied once at the source in `parseModelReply`, so every downstream use (history, nudges, the client-facing reply) is safe.

A third bug (frontend-only, already folded into the Entry 7 commit since `app/page.tsx` was never committed in the broken state): `AnimatePresence mode="wait"` around the composer/report-card swap could get stuck — the composer's exit animation never completed, so the report card stayed hidden behind it forever even though the API and React state were both already correct (verified directly via the React fiber). Removed `mode="wait"` and dropped the composer's `exit` animation so it unmounts instantly instead of waiting on a stalled transition.

**Prompt:**
> (Found and fixed while completing the "test it yourself in the browser" step
> above — not a separate user request. Reproduced by running full interviews
> against a real Anthropic session and watching the network/console/React state
> directly.)

---

## Entry 9 — Visual redesign: violet/cyan/aurora theme

**Built:** Restyled [`app/page.tsx`](app/page.tsx) — pure CSS/JSX changes, no logic touched. New palette (`#0a0a0f` base, `#8b5cf6`→`#06b6d4` violet-to-cyan accent gradient), a 3-blob violet/cyan/magenta aurora background that drifts and pulses on a slow Framer Motion loop, glassmorphic interviewer bubbles (`backdrop-blur` + faint accent border) against gradient-filled candidate bubbles, a gradient progress-bar fill with a glow shadow, a gradient-text headline and report-card header, and hover scale+glow on the candidate dropdown and send button. Also switched the progress-bar fill from an animated `width` to `transform: scaleX()` (compositor-friendly, standard best practice for animated bars) while investigating a rendering issue that turned out to be specific to this session's browser pane not being displayed/composited (confirmed via `document.visibilityState` staying `"hidden"` even after explicitly fronting the tab) — not a real app bug, so no other changes were made chasing it.

**Prompt:**
> This is a pure visual styling pass — do NOT touch any interview logic, API
> routes, or state handling. Redesign the visual theme of app/page.tsx with:
> a dark charcoal (#0a0a0f) base and violet-to-cyan (#8b5cf6→#06b6d4) accent
> gradient for buttons/progress fill/candidate bubbles/headline; a large blurred
> aurora-style violet/cyan/magenta gradient blob drifting/pulsing behind the
> content (the single biggest visual upgrade); glassmorphic interviewer bubbles
> vs gradient-filled candidate bubbles; a glowing gradient progress bar; a
> glass-style report card with a gradient accent; a bolder gradient-text
> headline, letter-spaced uppercase label, and smooth hover states (scale+glow)
> on the dropdown and send button. Quick visual check in the browser, then
> commit and push.
