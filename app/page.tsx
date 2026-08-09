"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import candidatesData from "@/data/candidates.json";

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

interface InterviewResponse {
  reply: string;
  done: boolean;
  history: HistoryMessage[];
  progress: Progress;
  feedback?: Feedback;
  error?: string;
}

type CandidateRecord = (typeof candidatesData)["candidates"][number];

const MAX_QUESTIONS = 10;
const MAX_DAYS = 4;
const candidates: CandidateRecord[] = candidatesData.candidates;

async function postInterview(body: unknown): Promise<InterviewResponse> {
  const res = await fetch("/api/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as InterviewResponse;
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data;
}

export default function Home() {
  const [selectedId, setSelectedId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [progress, setProgress] = useState<Progress>({
    questionsAsked: 0,
    daysCovered: [],
  });
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.member.id === selectedId) ?? null,
    [selectedId]
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, starting, sending, done]);

  async function handleSelectCandidate(id: string) {
    setSelectedId(id);
    setError(null);
    setDone(false);
    setFeedback(null);
    setHistory([]);
    setProgress({ questionsAsked: 0, daysCovered: [] });
    setInput("");

    const candidate = candidates.find((c) => c.member.id === id);
    if (!candidate) return;

    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setStarting(true);
    try {
      const data = await postInterview({ sessionId: newSessionId, candidate });
      setHistory(data.history);
      setProgress(data.progress);
      setDone(data.done);
      if (data.done) setFeedback(data.feedback ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start interview");
    } finally {
      setStarting(false);
    }
  }

  async function handleSend() {
    const message = input.trim();
    if (!message || !selectedCandidate || sending || starting || done) return;

    setInput("");
    setError(null);
    setSending(true);
    const priorHistory = history;
    setHistory((prev) => [...prev, { role: "user", content: message }]);

    try {
      const data = await postInterview({
        sessionId,
        candidate: selectedCandidate,
        message,
        history: priorHistory,
        progress,
      });
      setHistory(data.history);
      setProgress(data.progress);
      setDone(data.done);
      if (data.done) setFeedback(data.feedback ?? null);
    } catch (err) {
      setHistory(priorHistory);
      setInput(message);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0f] text-neutral-100">
      <BackgroundGlow />

      <main className="relative z-10 mx-auto w-full max-w-2xl px-6 py-14 sm:px-8">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#a78bfa]">
            ABTalks AI Cohort
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            Technical Interview
          </h1>

          <div className="mt-6">
            <label
              htmlFor="candidate"
              className="mb-2 block text-xs text-neutral-400"
            >
              Candidate
            </label>
            <select
              id="candidate"
              value={selectedId}
              onChange={(e) => handleSelectCandidate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-100 outline-none backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:border-[#8b5cf6]/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] focus:border-[#8b5cf6]/60 focus:shadow-[0_0_20px_rgba(139,92,246,0.3)]"
            >
              <option value="" disabled>
                Select a candidate…
              </option>
              {candidates.map((c) => (
                <option key={c.member.id} value={c.member.id}>
                  {c.member.name} — {c.member.jobRole}
                </option>
              ))}
            </select>
          </div>
        </header>

        {!selectedCandidate && (
          <p className="text-sm text-neutral-500">
            Pick a candidate above to begin their technical interview.
          </p>
        )}

        {selectedCandidate && (
          <section className="flex flex-col gap-4">
            <div className="sticky top-4 z-20 flex gap-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
              <ProgressStat
                label="Questions"
                value={progress.questionsAsked}
                max={MAX_QUESTIONS}
              />
              <ProgressStat
                label="Days covered"
                value={progress.daysCovered.length}
                max={MAX_DAYS}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm sm:p-6">
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {history.map((m, i) => (
                    <ChatBubble key={i} role={m.role} content={m.content} />
                  ))}
                  {(starting || sending) && <TypingBubble key="typing" />}
                </AnimatePresence>
              </div>
              <div ref={scrollRef} />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="sticky bottom-4 z-20">
              <AnimatePresence>
                {done && feedback ? (
                  <ReportCard key="report" feedback={feedback} />
                ) : (
                  <motion.div
                    key="composer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-xl"
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={starting || sending}
                      placeholder="Type your answer…"
                      className="flex-1 rounded-xl bg-transparent px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={starting || sending || !input.trim()}
                      className="rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
                    >
                      Send
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-1/3 -top-1/3 h-[70vh] w-[70vh] rounded-full bg-[#8b5cf6]/25 blur-[140px]"
        animate={{
          x: [0, 80, -50, 0],
          y: [0, 60, -40, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-1/3 -right-1/3 h-[65vh] w-[65vh] rounded-full bg-[#06b6d4]/20 blur-[140px]"
        animate={{
          x: [0, -70, 40, 0],
          y: [0, -50, 60, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/4 top-1/3 h-[50vh] w-[50vh] rounded-full bg-[#d946ef]/15 blur-[130px]"
        animate={{
          x: [0, 40, -60, 0],
          y: [0, -40, 30, 0],
          scale: [1, 1.1, 0.95, 1],
          opacity: [0.5, 0.85, 0.5],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function ChatBubble({ role, content }: HistoryMessage) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-[#8b5cf6] to-[#06b6d4] text-white shadow-[0_4px_24px_rgba(139,92,246,0.35)]"
            : "border border-[#8b5cf6]/20 bg-white/5 text-neutral-100 shadow-lg backdrop-blur-md"
        }`}
      >
        {content}
      </div>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-1.5 rounded-2xl border border-[#8b5cf6]/20 bg-white/5 px-4 py-3 backdrop-blur-md">
        {["#8b5cf6", "#a78bfa", "#06b6d4"].map((color, i) => (
          <motion.span
            key={color}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ProgressStat({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex-1">
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span className="tabular-nums text-neutral-200">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
}

function ReportCard({ feedback }: { feedback: Feedback }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl"
    >
      <div className="h-1 w-full bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]" />
      <div className="p-6">
        <h2 className="bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] bg-clip-text text-lg font-semibold text-transparent">
          Interview Report
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          {feedback.summary}
        </p>

        <ReportSection
          title="Strengths"
          items={feedback.strengths}
          dotClassName="bg-emerald-400"
        />
        <ReportSection
          title="Gaps"
          items={feedback.gaps}
          dotClassName="bg-amber-400"
        />
        <ReportSection
          title="Next steps"
          items={feedback.next}
          dotClassName="bg-[#06b6d4]"
        />
      </div>
    </motion.div>
  );
}

function ReportSection({
  title,
  items,
  dotClassName,
}: {
  title: string;
  items: string[];
  dotClassName: string;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-neutral-300">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
