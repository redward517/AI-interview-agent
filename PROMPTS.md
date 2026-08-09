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
