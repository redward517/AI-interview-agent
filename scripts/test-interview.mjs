// Smoke test for POST /api/interview. Requires the dev server running
// (npm run dev) and a valid ANTHROPIC_API_KEY / GROQ_API_KEY in .env.local.
//
// Usage: node scripts/test-interview.mjs [baseUrl]

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const endpoint = `${baseUrl}/api/interview`;

const candidate = {
  member: { name: "Sarah Johnson", jobRole: "Senior Data Engineer" },
  missions: [
    { day: 7, title: "Embeddings Explained", passed: true, attempts: 1 },
    { day: 10, title: "Retrieval & Matching Engine", passed: true, attempts: 2 },
    { day: 12, title: "Prompt Engineering Fundamentals", passed: true, attempts: 4 },
    { day: 29, title: "Monitoring, Logging & Observability", skipped: true },
  ],
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertBaseShape(body) {
  assert(typeof body.reply === "string" && body.reply.length > 0, "`reply` must be a non-empty string");
  assert(typeof body.done === "boolean", "`done` must be a boolean");
  assert(Array.isArray(body.history), "`history` must be an array");
  assert(
    typeof body.progress === "object" &&
      typeof body.progress.questionsAsked === "number" &&
      Array.isArray(body.progress.daysCovered),
    "`progress` must be { questionsAsked: number, daysCovered: number[] }"
  );
}

async function postJson(payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Response was not valid JSON (status ${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  console.log(`Testing ${endpoint}\n`);

  console.log("1) Starting a new session...");
  const start = await postJson({ candidate });
  assertBaseShape(start);
  assert(start.done === false, "start response must have done: false");
  assert(start.history.length === 1 && start.history[0].role === "assistant", "start history must contain exactly the opening reply");
  assert(start.progress.questionsAsked === 1, "start progress.questionsAsked must be 1");
  console.log("   OK — reply:", JSON.stringify(start.reply).slice(0, 120), "...");
  console.log("   progress:", start.progress, "\n");

  console.log("2) Sending one candidate reply (continuing turn)...");
  const turn = await postJson({
    candidate,
    message:
      "I'd log request IDs, retrieval latency, token counts, and errors at each pipeline stage so failures are traceable.",
    history: start.history,
    progress: start.progress,
  });
  assertBaseShape(turn);
  assert(
    turn.progress.questionsAsked === start.progress.questionsAsked + 1,
    "questionsAsked must increment by 1 per turn"
  );
  if (turn.done) {
    assert(
      typeof turn.feedback === "object" &&
        typeof turn.feedback.summary === "string" &&
        Array.isArray(turn.feedback.strengths) &&
        Array.isArray(turn.feedback.gaps) &&
        Array.isArray(turn.feedback.next),
      "when done: true, feedback must include summary/strengths/gaps/next"
    );
  }
  console.log("   OK — reply:", JSON.stringify(turn.reply).slice(0, 120), "...");
  console.log("   done:", turn.done, "progress:", turn.progress);

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error("\nTest failed:", err.message);
  process.exit(1);
});
