"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ScoreMeter } from "@/components/interview/ScoreMeter";
import { useAnonId } from "@/lib/anon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FinalReport, InterviewSession } from "@/lib/types";

const RECO_LABELS: Record<FinalReport["hire_recommendation"], string> = {
  strong_yes: "Strong hire",
  yes: "Hire",
  maybe: "Maybe",
  no: "No hire",
};

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportInner />
    </Suspense>
  );
}

function ReportInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const anonId = useAnonId();
  const idParam = sp.get("id") as Id<"sessions"> | null;

  const byId = useQuery(
    api.sessions.byId,
    idParam && anonId ? { id: idParam, anonId } : "skip",
  );
  const fallback = useQuery(
    api.sessions.history,
    !idParam && anonId ? { anonId } : "skip",
  );

  const sessionDoc = byId ?? fallback?.[0] ?? null;
  const sessionLoading = idParam ? byId === undefined : fallback === undefined;

  useEffect(() => {
    if (!sessionLoading && !sessionDoc) {
      router.replace("/dashboard");
    }
  }, [sessionLoading, sessionDoc, router]);

  if (!sessionDoc) return null;

  const session = sessionDoc.sessionBlob as InterviewSession;
  const report = sessionDoc.reportBlob as FinalReport | undefined;
  const aggregate = sessionDoc.aggregate;

  if (!report || !aggregate) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">Back to dashboard</Button>
          </Link>
        </div>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-8 border-y border-ink-800 py-10 md:grid-cols-[1fr_2fr]">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
            Verdict
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-7xl tracking-tight text-ink-50">
              {Math.round(report.overall_score)}
            </span>
            <span className="text-ink-500">/100</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-sm border border-accent/40 bg-accent/10 px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="font-mono text-xs uppercase tracking-widest text-accent">
              {RECO_LABELS[report.hire_recommendation]}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 self-end">
          <SubScore label="Technical" value={aggregate.technical} />
          <SubScore label="Communication" value={aggregate.communication} />
          <SubScore label="Confidence" value={aggregate.confidence} />
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ColumnList
          title="Top strengths"
          items={report.top_3_strengths}
          accent
        />
        <ColumnList
          title="Top improvements"
          items={report.top_3_improvements}
        />
      </section>

      <section className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-3">
        <BreakdownCard
          title="Technical"
          score={report.technical_summary.score}
          rows={[
            ["Strengths", report.technical_summary.strengths],
            ["Gaps", report.technical_summary.gaps],
            ["Study", report.technical_summary.study_topics],
          ]}
        />
        <BreakdownCard
          title="Communication"
          score={report.communication_summary.score}
          rows={[
            ["Observations", report.communication_summary.observations],
            ["Tips", report.communication_summary.tips],
          ]}
        />
        <BreakdownCard
          title="Confidence"
          score={report.confidence_summary.score}
          rows={[
            ["Observations", report.confidence_summary.observations],
            ["Tips", report.confidence_summary.tips],
          ]}
        />
      </section>

      <section className="mt-16">
        <div className="mb-6 flex items-end justify-between">
          <h3 className="font-display text-3xl tracking-tight text-ink-50">
            Question-by-question breakdown
          </h3>
          <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
            {session.answers.length} answered
          </span>
        </div>
        <div className="space-y-4">
          {session.answers.map((a, i) => (
            <QuestionAnalysisCard key={i} index={i} answer={a} />
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h3 className="font-display text-2xl tracking-tight text-ink-50">
          Next steps
        </h3>
        <ol className="mt-5 space-y-3">
          {report.next_steps.map((s, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-lg border border-ink-800 bg-ink-900/40 p-5 text-base leading-relaxed text-ink-100"
            >
              <span className="font-mono text-sm text-accent">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function QuestionAnalysisCard({
  index,
  answer,
}: {
  index: number;
  answer: InterviewSession["answers"][number];
}) {
  const tech = Math.round(answer.combined_score.technical);
  const techTone =
    tech >= 75
      ? "text-accent"
      : tech >= 50
        ? "text-ink-100"
        : "text-red-300";
  return (
    <details
      open={index === 0}
      className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-900/40 transition-colors open:bg-ink-900/60"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 hover:bg-ink-900/70">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-sm bg-ink-50 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-ink-950">
              Q{index + 1}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
              {answer.question.type.replace("_", " ")} · difficulty{" "}
              {answer.question.difficulty}/5
            </span>
          </div>
          <p className="font-display text-xl leading-snug text-ink-50">
            {answer.question.question}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={`font-display text-4xl ${techTone}`}>{tech}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            tech score
          </span>
        </div>
      </summary>

      <div className="space-y-5 border-t border-ink-800 p-6">
        {/* Transcript */}
        <div className="rounded-md border border-ink-800 bg-ink-950 p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
              Your answer
            </span>
            <span className="font-mono text-[11px] text-ink-500">
              {answer.audio.speech_rate_wpm} wpm ·{" "}
              {answer.audio.hesitation_count} fillers ·{" "}
              {Math.round(answer.audio.duration_sec)}s
            </span>
          </div>
          <p className="text-base leading-relaxed text-ink-100">
            {answer.transcript || (
              <span className="italic text-ink-600">(silent)</span>
            )}
          </p>
          {answer.raw_transcript &&
            answer.raw_transcript !== answer.transcript && (
              <details className="mt-3 text-xs text-ink-500">
                <summary className="cursor-pointer font-mono uppercase tracking-widest hover:text-ink-300">
                  Show raw STT output
                </summary>
                <p className="mt-2 leading-relaxed text-ink-400">
                  {answer.raw_transcript}
                </p>
              </details>
            )}
        </div>

        {/* Eval scores */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <EvalScoreTile
            label="Correctness"
            value={answer.evaluation.correctness_score}
          />
          <EvalScoreTile
            label="Depth"
            value={answer.evaluation.depth_score}
          />
          <div className="rounded-md border border-ink-800 bg-ink-950 p-4">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-ink-400">
              Soft signals
            </div>
            <ScoreMeter
              label="Communication"
              value={answer.combined_score.communication}
              accent
            />
            <div className="mt-3">
              <ScoreMeter
                label="Confidence"
                value={answer.combined_score.confidence}
              />
            </div>
          </div>
        </div>

        {/* Strengths + Gaps */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md border border-accent/30 bg-accent/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-accent">
                What you got right
              </span>
            </div>
            {answer.evaluation.strengths.length ? (
              <ul className="space-y-2">
                {answer.evaluation.strengths.map((s, j) => (
                  <li
                    key={j}
                    className="text-sm leading-relaxed text-ink-100"
                  >
                    · {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-ink-500">
                Nothing notable.
              </p>
            )}
          </div>

          <div className="rounded-md border border-red-900/40 bg-red-950/20 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-red-300">
                What you missed
              </span>
            </div>
            {answer.evaluation.missing_concepts.length ? (
              <ul className="space-y-2">
                {answer.evaluation.missing_concepts.map((s, j) => (
                  <li
                    key={j}
                    className="text-sm leading-relaxed text-ink-100"
                  >
                    · {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-ink-500">
                Covered everything material.
              </p>
            )}
          </div>
        </div>

        {/* Ideal answer */}
        <div className="rounded-md border border-ink-700 bg-ink-950 p-5">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-ink-300">
            Ideal answer
          </div>
          <p className="text-base leading-relaxed text-ink-100">
            {answer.evaluation.brief_ideal_answer}
          </p>
        </div>

        {answer.evaluation.follow_up_if_weak && (
          <div className="rounded-md border border-ink-800 bg-ink-900/40 p-4">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Likely follow-up
            </div>
            <p className="text-sm italic text-ink-300">
              &ldquo;{answer.evaluation.follow_up_if_weak}&rdquo;
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

function EvalScoreTile({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 75
      ? "text-accent"
      : value >= 50
        ? "text-ink-100"
        : "text-red-300";
  return (
    <div className="rounded-md border border-ink-800 bg-ink-950 p-4">
      <div className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
        {label}
      </div>
      <div className={`mt-2 font-display text-4xl ${tone}`}>
        {Math.round(value)}
      </div>
      <div className="mt-1 font-mono text-[10px] text-ink-600">/100</div>
    </div>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
      <div className="text-xs uppercase tracking-widest text-ink-400">
        {label}
      </div>
      <div className="mt-2 font-display text-4xl text-ink-50">
        {Math.round(value)}
      </div>
      <div className="mt-3">
        <ScoreMeter label="" value={value} />
      </div>
    </div>
  );
}

function ColumnList({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-6">
      <span className="font-mono text-xs uppercase tracking-widest text-ink-400">
        {title}
      </span>
      <ul className="mt-4 space-y-3">
        {items.map((s, i) => (
          <li key={i} className="flex gap-3 text-base leading-relaxed text-ink-100">
            <span
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent ? "bg-accent" : "bg-ink-400"}`}
            />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BreakdownCard({
  title,
  score,
  rows,
}: {
  title: string;
  score: number;
  rows: [string, string[]][];
}) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-6">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-400">
          {title}
        </span>
        <span className="font-mono text-3xl text-ink-50">{Math.round(score)}</span>
      </div>
      {rows.map(([label, items]) => (
        <div key={label} className="mt-5">
          <div className="text-xs uppercase tracking-widest text-ink-400">
            {label}
          </div>
          <ul className="mt-2 space-y-1.5">
            {items.map((it, i) => (
              <li key={i} className="text-sm leading-relaxed text-ink-200">
                · {it}
              </li>
            ))}
            {!items.length && <li className="text-sm text-ink-600">—</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
