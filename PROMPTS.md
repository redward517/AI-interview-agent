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
