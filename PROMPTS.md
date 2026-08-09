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
