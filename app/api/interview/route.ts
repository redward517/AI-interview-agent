import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getModel } from "@/lib/model";
import {
  buildSystemPrompt,
  type Candidate,
  type CurriculumDay,
} from "@/lib/systemPrompt";
import curriculumData from "@/data/curriculum.json";

interface CurriculumDayRaw {
  day: number;
  title: string;
  objectives: string[];
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface Progress {
  questionsAsked: number;
  daysCovered: number[];
}

interface Feedback {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
}

interface ModelReply {
  reply: string;
  done: boolean;
  currentDay: number;
  feedback?: Feedback;
}

const MAX_CURRICULUM_DAYS = 6;
const MIN_QUESTIONS = 10;
const MIN_DAYS_COVERED = 4;
const MAX_CONTINUE_NUDGES = 2;

const allCurriculumDays = (curriculumData as { days: CurriculumDayRaw[] })
  .days;

// Selection is re-derived from `candidate` on every request (start or
// continue) instead of being persisted server-side, since this endpoint
// keeps no session state between calls.
function selectCurriculumDays(
  candidate: Candidate,
  max = MAX_CURRICULUM_DAYS
): CurriculumDay[] {
  const missionByDay = new Map(candidate.missions.map((m) => [m.day, m]));
  const flagged: number[] = [];
  const untouched: number[] = [];
  const rest: number[] = [];

  for (const d of allCurriculumDays) {
    const mission = missionByDay.get(d.day);
    if (!mission) {
      untouched.push(d.day);
    } else if (mission.skipped || (mission.attempts ?? 0) > 1) {
      flagged.push(d.day);
    } else {
      rest.push(d.day);
    }
  }

  const selected = new Set([...flagged, ...untouched, ...rest].slice(0, max));

  return allCurriculumDays
    .filter((d) => selected.has(d.day))
    .map((d) => ({ day: d.day, title: d.title, objectives: d.objectives }));
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return JSON.parse(fenced[1]);
  try {
    return JSON.parse(trimmed);
  } catch {
    // Model sometimes wraps the JSON in prose despite instructions; fall
    // back to the first balanced-looking {...} block before giving up.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new SyntaxError("No JSON object found in model response");
    return JSON.parse(match[0]);
  }
}

function isFeedback(x: unknown): x is Feedback {
  if (typeof x !== "object" || x === null) return false;
  const f = x as Record<string, unknown>;
  return (
    typeof f.summary === "string" &&
    Array.isArray(f.strengths) &&
    Array.isArray(f.gaps) &&
    Array.isArray(f.next)
  );
}

function parseModelReply(text: string): ModelReply {
  const parsed = extractJson(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Model reply is not a JSON object");
  }
  const r = parsed as Record<string, unknown>;
  if (
    typeof r.reply !== "string" ||
    typeof r.done !== "boolean" ||
    typeof r.currentDay !== "number"
  ) {
    throw new Error("Model reply is missing reply/done/currentDay");
  }
  if (r.done && !isFeedback(r.feedback)) {
    throw new Error("Model reply marked done but feedback is missing/invalid");
  }
  return {
    reply: nonEmpty(r.reply),
    done: r.done,
    currentDay: r.currentDay,
    feedback: r.done ? (r.feedback as Feedback) : undefined,
  };
}

const MAX_JSON_RETRIES = 2;

// The Anthropic API rejects messages with empty text content blocks, which
// can happen if the model returns an empty completion; guard before echoing
// any model output back into a later turn.
function nonEmpty(text: string): string {
  return text.trim().length > 0 ? text : "(no response)";
}

// The model occasionally breaks the JSON-only output rule mid-conversation
// (drifting into plain prose). Retry with a corrective nudge — not persisted
// into the returned history — before giving up.
async function callModel(
  system: string,
  messages: HistoryMessage[]
): Promise<ModelReply> {
  let attemptMessages = messages;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    const { text } = await generateText({
      model: getModel(),
      instructions: system,
      messages: attemptMessages,
    });
    try {
      return parseModelReply(text);
    } catch (err) {
      lastError = err;
      attemptMessages = [
        ...attemptMessages,
        { role: "assistant", content: nonEmpty(text) },
        {
          role: "user",
          content:
            "Your previous response was not valid JSON. Respond again with ONLY the JSON object described in the OUTPUT rules — no prose, no markdown.",
        },
      ];
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Model did not return valid JSON");
}

function meetsCompletionGate(questionsAsked: number, daysCovered: number[]) {
  return (
    questionsAsked >= MIN_QUESTIONS && daysCovered.length >= MIN_DAYS_COVERED
  );
}

function addUniqueDay(days: number[], day: number): number[] {
  return days.includes(day) ? days : [...days, day];
}

function isCandidate(x: unknown): x is Candidate {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.member === "object" &&
    c.member !== null &&
    Array.isArray(c.missions)
  );
}

async function startSession(candidate: Candidate) {
  const curriculumDays = selectCurriculumDays(candidate);
  const system = buildSystemPrompt(candidate, curriculumDays);

  const modelReply = await callModel(system, [
    {
      role: "user",
      content:
        "Begin the interview now: greet the candidate by name and ask your first question.",
    },
  ]);

  const history: HistoryMessage[] = [
    { role: "assistant", content: modelReply.reply },
  ];
  const progress: Progress = {
    questionsAsked: 1,
    daysCovered: [modelReply.currentDay],
  };

  return NextResponse.json({
    reply: modelReply.reply,
    done: false,
    history,
    progress,
  });
}

async function continueSession(
  candidate: Candidate,
  message: string,
  history: HistoryMessage[],
  progress: Progress
) {
  const curriculumDays = selectCurriculumDays(candidate);
  const system = buildSystemPrompt(candidate, curriculumDays);

  const baseMessages: HistoryMessage[] = [
    ...history,
    { role: "user", content: message },
  ];

  // Nudge messages used to correct a premature end-of-interview attempt are
  // only sent to the model for this call — they are never persisted into the
  // history returned to the client.
  let callMessages = baseMessages;
  let modelReply = await callModel(system, callMessages);

  let nudges = 0;
  while (
    modelReply.done &&
    !meetsCompletionGate(
      progress.questionsAsked + 1,
      addUniqueDay(progress.daysCovered, modelReply.currentDay)
    ) &&
    nudges < MAX_CONTINUE_NUDGES
  ) {
    callMessages = [
      ...callMessages,
      { role: "assistant", content: modelReply.reply },
      {
        role: "user",
        content:
          "You have not yet covered the minimum of 10 questions across 4+ curriculum days. Do not end the interview yet — ask another question instead.",
      },
    ];
    modelReply = await callModel(system, callMessages);
    nudges++;
  }

  const questionsAsked = progress.questionsAsked + 1;
  const daysCovered = addUniqueDay(progress.daysCovered, modelReply.currentDay);
  const done = modelReply.done && meetsCompletionGate(questionsAsked, daysCovered);

  const newHistory: HistoryMessage[] = [
    ...baseMessages,
    { role: "assistant", content: modelReply.reply },
  ];

  const responseBody: Record<string, unknown> = {
    reply: modelReply.reply,
    done,
    history: newHistory,
    progress: { questionsAsked, daysCovered },
  };
  if (done && modelReply.feedback) {
    responseBody.feedback = modelReply.feedback;
  }

  return NextResponse.json(responseBody);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  try {
    if (b.candidate !== undefined && b.message === undefined) {
      if (!isCandidate(b.candidate)) {
        return NextResponse.json(
          { error: "candidate must include member and missions" },
          { status: 400 }
        );
      }
      return await startSession(b.candidate);
    }

    if (
      typeof b.message === "string" &&
      Array.isArray(b.history) &&
      typeof b.progress === "object" &&
      b.progress !== null
    ) {
      if (!isCandidate(b.candidate)) {
        return NextResponse.json(
          { error: "candidate must be included on every turn" },
          { status: 400 }
        );
      }
      return await continueSession(
        b.candidate,
        b.message,
        b.history as HistoryMessage[],
        b.progress as Progress
      );
    }

    return NextResponse.json(
      {
        error:
          "Request must include either `candidate` (to start) or `message`, `history`, `progress`, and `candidate` (to continue).",
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("[/api/interview] error", err);
    return NextResponse.json(
      { error: "Failed to generate interview response" },
      { status: 502 }
    );
  }
}
