"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Mic, MicOff, ArrowRight, Camera, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ScoreMeter } from "@/components/interview/ScoreMeter";
import { useDeepgramStream } from "@/hooks/useDeepgramStream";
import { useVisualMetrics } from "@/hooks/useVisualMetrics";
import { useAnonId } from "@/lib/anon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  analyzeTranscript,
  communicationScore,
  confidenceScore,
} from "@/lib/deepgram";
import type {
  AnswerRecord,
  InterviewQuestion,
  InterviewSession,
} from "@/lib/types";

type Phase =
  | "permissions"
  | "ready"
  | "asking"
  | "answering"
  | "evaluating"
  | "compiling"
  | "done";

export default function InterviewPage() {
  const router = useRouter();
  const anonId = useAnonId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const navigatingRef = useRef(false);

  const sessionDoc = useQuery(
    api.sessions.active,
    anonId ? { anonId } : "skip",
  );

  const updateSession = useMutation(api.sessions.update);
  const completeSession = useMutation(api.sessions.complete);

  const [overrideBlob, setOverrideBlob] = useState<InterviewSession | null>(null);
  const sessionId = (sessionDoc?._id ?? null) as Id<"sessions"> | null;
  const session: InterviewSession | null =
    overrideBlob ??
    (sessionDoc?.sessionBlob as InterviewSession | undefined) ??
    null;

  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>("permissions");
  const [error, setError] = useState<string | null>(null);

  const dg = useDeepgramStream();
  const visual = useVisualMetrics(videoRef, phase === "answering");

  useEffect(() => {
    if (anonId && sessionDoc === null && !navigatingRef.current) {
      router.replace("/dashboard");
    }
  }, [router, anonId, sessionDoc]);

  async function persist(updated: InterviewSession) {
    setOverrideBlob(updated);
    if (sessionId && anonId) {
      await updateSession({ id: sessionId, anonId, sessionBlob: updated });
    }
  }

  async function grantPermissions() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { });
      }
      setPhase("ready");
    } catch {
      setError(
        "Camera/mic blocked. Allow access in your browser to begin the interview.",
      );
    }
  }

  async function fetchNextQuestion(s: InterviewSession) {
    setPhase("asking");
    const res = await fetch("/api/interview/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: s }),
    });
    const data = await res.json();
    if (data.done) {
      navigatingRef.current = true;
      setPhase("compiling");
      const finished = { ...s, status: "completed" as const };
      const reportRes = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: finished }),
      });
      const reportData = await reportRes.json();
      if (sessionId && anonId && reportData.report && reportData.aggregate) {
        await completeSession({
          id: sessionId,
          anonId,
          sessionBlob: finished,
          reportBlob: reportData.report,
          aggregate: reportData.aggregate,
          overall: reportData.report.overall_score,
          hire: reportData.report.hire_recommendation,
        });
      }
      setOverrideBlob(finished);
      router.push(`/report?id=${sessionId ?? ""}`);
      return;
    }
    setQuestion(data.question);
    const updated: InterviewSession = {
      ...s,
      questions: [...s.questions, data.question],
      difficultyLevel: data.question.difficulty,
    };
    await persist(updated);
    setPhase("ready");
  }

  async function startAnswer() {
    if (!streamRef.current || !session) return;
    setPhase("answering");
    const audioStream = new MediaStream(streamRef.current.getAudioTracks());
    await dg.start(audioStream, { keyterms: buildKeyterms(session) });
  }

  async function endAnswer() {
    if (!session || !question) return;
    setPhase("evaluating");
    const result = await dg.stop();
    const transcript = result.final.trim() || "(no answer)";
    const audio = analyzeTranscript(
      transcript,
      result.durationSec || 30,
      result.wordConfidences,
    );
    const visualSnap = visual.snapshot();

    const evalRes = await fetch("/api/interview/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        transcript,
        audio,
        visual: visualSnap,
        role: session.targetRole,
        resume_raw: session.resume.raw_text,
        resume_skills: [
          ...(session.resume.skills?.strong ?? []),
          ...(session.resume.skills?.moderate ?? []),
        ],
      }),
    });
    const evalData = await evalRes.json();
    const cleanedTranscript: string =
      typeof evalData.cleaned_transcript === "string" &&
        evalData.cleaned_transcript.trim()
        ? evalData.cleaned_transcript
        : transcript;

    const answer: AnswerRecord = {
      question,
      transcript: cleanedTranscript,
      raw_transcript: transcript,
      evaluation: evalData.evaluation,
      audio,
      visual: visualSnap,
      combined_score: evalData.combined_score,
    };

    const updated: InterviewSession = {
      ...session,
      answers: [...session.answers, answer],
    };
    await persist(updated);
    setQuestion(null);
    visual.reset();
    void fetchNextQuestion(updated);
  }

  // Stop tracks when the tab actually navigates away. We deliberately don't
  // stop them in a useEffect cleanup — React 19 strict-mode runs effect
  // cleanups on the first mount-unmount-mount cycle, which would kill the
  // camera the instant we open the page.
  useEffect(() => {
    function handleHide() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
    window.addEventListener("pagehide", handleHide);
    return () => window.removeEventListener("pagehide", handleHide);
  }, []);

  // Recovery: if the video element ever loses its srcObject (hot-reload,
  // remount, etc.) but we still have a live stream, re-attach it.
  useEffect(() => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (v && s && v.srcObject !== s) {
      v.srcObject = s;
      v.play().catch(() => { });
    }
  }, [phase]);

  if (!session) return null;

  const liveAudio = analyzeTranscript(
    (dg.state.final + " " + dg.state.interim) || "",
    Math.max(dg.state.durationSec, 1),
    dg.state.wordConfidences,
  );
  const liveComm = communicationScore(liveAudio);
  const liveConf = confidenceScore(liveAudio, visual.live);

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo />
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* LEFT: Video + question */}
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-800 pb-3">
            <div className="min-w-0">
              <div className="font-mono text-xs uppercase tracking-widest text-ink-500">
                Question{" "}
                {session.answers.length + (question ? 1 : 0)} · adaptive
                length
              </div>
              <div className="mt-1 font-display text-2xl tracking-tight text-ink-50">
                {session.targetRole}
              </div>
            </div>
            {phase === "answering" && (
              <span className="inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-widest text-accent">
                  Recording
                </span>
              </span>
            )}
          </div>

          <div className="relative aspect-video overflow-hidden rounded-lg border border-ink-800 bg-ink-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            {phase === "permissions" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink-950/85 backdrop-blur-sm">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-ink-700">
                  <Camera className="h-5 w-5 text-ink-300" />
                </div>
                <div className="max-w-sm text-center">
                  <h3 className="font-display text-xl text-ink-50">
                    Camera & mic, please.
                  </h3>
                  <p className="mt-1 text-sm text-ink-400">
                    Used live in your browser only. Nothing is recorded or stored.
                  </p>
                </div>
                <Button variant="accent" onClick={grantPermissions}>
                  Grant access
                </Button>
                {error && <span className="text-xs text-red-300">{error}</span>}
              </div>
            )}
            {phase === "evaluating" && (
              <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-ink-950/80 px-3 py-1.5 backdrop-blur-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
                  Evaluating
                </span>
              </div>
            )}
          </div>

          {/* Question card */}
          <div className="rounded-lg border border-ink-800 bg-ink-900/50 p-6">
            {phase === "ready" && !question && (
              <div className="flex items-center justify-between gap-6">
                <div>
                  <span className="font-mono text-xs uppercase tracking-widest text-ink-400">
                    Ready
                  </span>
                  <p className="mt-2 text-xl text-ink-100">
                    Permissions granted. Pull the first question when you&apos;re ready.
                  </p>
                </div>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => fetchNextQuestion(session)}
                >
                  Start interview
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {phase === "asking" && (
              <div className="flex items-center gap-3 text-ink-200">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span className="text-base">Generating next question…</span>
              </div>
            )}

            {phase === "compiling" && (
              <div className="flex items-center gap-3 text-ink-100">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-lg">
                  Interview complete. Compiling your final report…
                </span>
              </div>
            )}

            {(phase === "ready" ||
              phase === "answering" ||
              phase === "evaluating") &&
              question && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-sm bg-ink-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-950">
                      {question.type.replace("_", " ")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                      Difficulty {question.difficulty}/5
                    </span>
                  </div>
                  <p className="font-display text-[22px] leading-snug text-ink-50">
                    {question.question}
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    {phase === "ready" && (
                      <Button variant="accent" onClick={startAnswer}>
                        <Mic className="h-4 w-4" />
                        Begin answer
                      </Button>
                    )}
                    {phase === "answering" && (
                      <Button variant="primary" onClick={endAnswer}>
                        <MicOff className="h-4 w-4" />
                        Submit answer
                      </Button>
                    )}
                    {phase === "evaluating" && (
                      <span className="inline-flex items-center gap-2 text-sm text-ink-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                        Scoring your answer…
                      </span>
                    )}
                    {phase !== "evaluating" && (
                      <span className="font-mono text-xs text-ink-500">
                        {phase === "answering"
                          ? `${dg.state.durationSec.toFixed(0)}s`
                          : "press to record"}
                      </span>
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* Live transcript — visible while answering and during eval */}
          {(phase === "answering" || phase === "evaluating") && (
            <div className="rounded-lg border border-ink-800 bg-ink-950 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-ink-500">
                  {phase === "answering" ? "Live transcript" : "Your answer"}
                </span>
                <span className="font-mono text-[10px] text-ink-500">
                  {liveAudio.speech_rate_wpm || 0} wpm ·{" "}
                  {liveAudio.hesitation_count} fillers
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <p className="min-h-12 text-base leading-relaxed text-ink-100">
                  {dg.state.final || (
                    <span className="text-ink-500">
                      Listening… speak naturally.
                    </span>
                  )}
                  <span className="text-ink-400"> {dg.state.interim}</span>
                </p>
              </div>
              {dg.state.error && (
                <p className="mt-2 text-xs text-red-300">
                  {dg.state.error}. Falling back to silent recording — the
                  answer will still be evaluated.
                </p>
              )}
            </div>
          )}

          {/* Past answers (was previously in the right sidebar — too cramped there) */}
          {session.answers.length > 0 && (
            <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-400">
                  Past answers
                </span>
                <span className="font-mono text-xs text-ink-500">
                  {session.answers.length} of this session
                </span>
              </div>
              <div className="space-y-2">
                {session.answers.map((a, i) => (
                  <details
                    key={i}
                    className="group rounded border border-ink-800 bg-ink-950/40 open:bg-ink-950/70"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                          Q{i + 1} · {a.question.type.replace("_", " ")} · d
                          {a.question.difficulty}
                        </div>
                        <div className="mt-1 truncate text-sm text-ink-100">
                          {a.question.question}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-1">
                        <span className="font-mono text-xl text-ink-50">
                          {Math.round(a.combined_score.technical)}
                        </span>
                        <span className="text-[10px] text-ink-500">tech</span>
                      </div>
                    </summary>
                    <div className="space-y-3 border-t border-ink-800 px-4 py-3">
                      <p className="text-sm leading-relaxed text-ink-200">
                        {a.transcript || (
                          <span className="italic text-ink-600">(silent)</span>
                        )}
                      </p>
                      <div className="font-mono text-[11px] text-ink-500">
                        correctness {a.evaluation.correctness_score} · depth{" "}
                        {a.evaluation.depth_score} · {a.audio.speech_rate_wpm}{" "}
                        wpm · {a.audio.hesitation_count} fillers
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: live meters + history */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-ink-400">
                Live signals
              </span>
              {phase === "answering" ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[14px] uppercase tracking-widest text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="font-mono text-[14px] uppercase tracking-widest text-ink-600">
                  Idle
                </span>
              )}
            </div>
            {phase === "answering" &&
              dg.state.durationSec > 8 &&
              liveConf < 40 && (
                <div className="mb-4 rounded border border-accent/40 bg-accent/10 p-3">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-accent">
                    Coaching
                  </div>
                  <p className="text-xs leading-relaxed text-ink-200">
                    Take a breath. Structure your answer: define the term, give an
                    example, mention a tradeoff.
                  </p>
                </div>
              )}
            <div className="space-y-4">
              <ScoreMeter label="Communication" value={liveComm} accent />
              <ScoreMeter label="Confidence" value={liveConf} />
              <ScoreMeter
                label="Engagement"
                value={visual.live.engagement * 100}
              />
              <ScoreMeter
                label="Composure"
                value={visual.live.composure * 100}
              />
              <ScoreMeter
                label="Stress"
                value={visual.live.stress_level * 100}
              />
            </div>
          </div>

        </aside>
      </div>
    </main>
  );
}

// Builds a keyterm boost list from the candidate's resume so Deepgram
// recognises tech jargon (Convex, PostHog, Next.js, tRPC, Clerk, etc.)
// that would otherwise come back as homophones.
function buildKeyterms(session: InterviewSession): string[] {
  const terms = new Set<string>();
  const push = (xs: string[] | undefined) => {
    for (const t of xs ?? []) {
      const trimmed = (t ?? "").trim();
      if (trimmed.length >= 2 && trimmed.length <= 64) terms.add(trimmed);
    }
  };
  const r = session.resume;
  push(r.skills?.strong);
  push(r.skills?.moderate);
  for (const role of r.inferred_roles ?? []) {
    push(role.interview_focus?.core_skills);
    push(role.interview_focus?.probe_areas);
    push(role.interview_focus?.project_deep_dives);
  }

  // Pull obvious proper-noun-shaped tokens (PascalCase / dotted / hyphenated)
  // out of the raw resume text so project and tool names not in the parsed
  // skill lists still get boosted.
  const raw = r.raw_text ?? "";
  const matches = raw.match(/\b[A-Z][A-Za-z0-9]*(?:[.\-_][A-Za-z0-9]+)*\b/g);
  for (const m of matches ?? []) {
    if (m.length >= 3 && m.length <= 32) terms.add(m);
  }

  return Array.from(terms);
}
