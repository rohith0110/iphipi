"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, ArrowRight, Camera, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ScoreMeter } from "@/components/interview/ScoreMeter";
import { useDeepgramStream } from "@/hooks/useDeepgramStream";
import { useVisualMetrics } from "@/hooks/useVisualMetrics";
import { store } from "@/lib/session-store";
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

type Phase = "permissions" | "ready" | "asking" | "answering" | "evaluating" | "done";

export default function InterviewPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [phase, setPhase] = useState<Phase>("permissions");
  const [error, setError] = useState<string | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);

  const dg = useDeepgramStream();
  const visual = useVisualMetrics(videoRef.current, phase === "answering");

  useEffect(() => {
    const s = store.getSession();
    if (!s) {
      router.replace("/dashboard");
      return;
    }
    setSession(s);
  }, [router]);

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
        await videoRef.current.play().catch(() => {});
      }
      setPhase("ready");
    } catch (e) {
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
      const finished = { ...s, status: "completed" as const };
      store.setSession(finished);
      const reportRes = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: finished }),
      });
      const reportData = await reportRes.json();
      store.setReport(reportData);
      router.push("/report");
      return;
    }
    setQuestion(data.question);
    setEncouragement(data.question.encouragement ?? null);
    const updated: InterviewSession = {
      ...s,
      questions: [...s.questions, data.question],
      difficultyLevel: data.question.difficulty,
    };
    setSession(updated);
    store.setSession(updated);
    setPhase("ready");
  }

  async function startAnswer() {
    if (!streamRef.current) return;
    setPhase("answering");
    const audioStream = new MediaStream(streamRef.current.getAudioTracks());
    await dg.start(audioStream);
  }

  async function endAnswer() {
    if (!session || !question) return;
    setPhase("evaluating");
    await dg.stop();
    const transcript =
      (dg.state.final + " " + dg.state.interim).trim() || "(no answer)";
    const audio = analyzeTranscript(
      transcript,
      dg.state.durationSec || 30,
      dg.state.wordConfidences,
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
      }),
    });
    const evalData = await evalRes.json();

    const answer: AnswerRecord = {
      question,
      transcript,
      evaluation: evalData.evaluation,
      audio,
      visual: visualSnap,
      combined_score: evalData.combined_score,
    };

    const updated: InterviewSession = {
      ...session,
      answers: [...session.answers, answer],
    };
    setSession(updated);
    store.setSession(updated);
    setQuestion(null);
    visual.reset();
    void fetchNextQuestion(updated);
  }

  // teardown camera/mic on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
        <div className="flex items-center gap-4">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
            {session.targetRole} · Q{session.answers.length + (question ? 1 : 0)}/8
          </span>
          {phase === "answering" && (
            <span className="inline-flex items-center gap-2 text-xs text-accent">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              recording
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 lg:grid-cols-[1.4fr_1fr]">
        {/* LEFT: Video + question */}
        <div className="space-y-4">
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
              <div className="absolute inset-0 flex items-center justify-center gap-3 bg-ink-950/70 backdrop-blur-sm">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span className="text-sm text-ink-100">Evaluating answer…</span>
              </div>
            )}
          </div>

          {/* Question card */}
          <div className="rounded-lg border border-ink-800 bg-ink-900/50 p-6">
            {phase === "ready" && !question && (
              <div className="flex items-center justify-between gap-6">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
                    Ready
                  </span>
                  <p className="mt-2 text-lg text-ink-100">
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
              <div className="flex items-center gap-3 text-ink-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating next question…</span>
              </div>
            )}

            {(phase === "ready" || phase === "answering") && question && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-sm bg-ink-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-950">
                    {question.type.replace("_", " ")}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    Difficulty {question.difficulty}/5
                  </span>
                </div>
                {encouragement && (
                  <p className="mb-3 text-xs italic text-accent">{encouragement}</p>
                )}
                <p className="font-display text-2xl leading-snug text-ink-50">
                  {question.question}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  {phase === "ready" ? (
                    <Button variant="accent" onClick={startAnswer}>
                      <Mic className="h-4 w-4" />
                      Begin answer
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={endAnswer}>
                      <MicOff className="h-4 w-4" />
                      Submit answer
                    </Button>
                  )}
                  <span className="font-mono text-xs text-ink-500">
                    {phase === "answering"
                      ? `${dg.state.durationSec.toFixed(0)}s`
                      : "press to record"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Live transcript */}
          {phase === "answering" && (
            <div className="rounded-lg border border-ink-800 bg-ink-950 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-ink-500">
                  Live transcript
                </span>
                <span className="font-mono text-[10px] text-ink-500">
                  {liveAudio.speech_rate_wpm || 0} wpm · {liveAudio.hesitation_count} fillers
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink-200">
                {dg.state.final}
                <span className="text-ink-500"> {dg.state.interim}</span>
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: live meters + history */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
                Live signals
              </span>
              <span className="text-[10px] text-ink-600">
                frames · {visual.live.frame_count}
              </span>
            </div>
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

          <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
              History
            </span>
            <ul className="mt-3 space-y-2">
              {session.answers.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 border-t border-ink-800 pt-2 text-xs first:border-0 first:pt-0"
                >
                  <span className="truncate text-ink-300">
                    Q{i + 1}. {a.question.question}
                  </span>
                  <span className="font-mono text-ink-100">
                    {Math.round(a.combined_score.technical)}
                  </span>
                </li>
              ))}
              {!session.answers.length && (
                <li className="text-xs text-ink-600">No answers yet.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
