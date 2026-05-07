"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ScoreMeter } from "@/components/interview/ScoreMeter";
import { store } from "@/lib/session-store";
import type { FinalReport, InterviewSession } from "@/lib/types";

interface ReportPayload {
  report: FinalReport;
  aggregate: { technical: number; communication: number; confidence: number };
}

const RECO_LABELS: Record<FinalReport["hire_recommendation"], string> = {
  strong_yes: "Strong hire",
  yes: "Hire",
  maybe: "Maybe",
  no: "No hire",
};

export default function ReportPage() {
  const router = useRouter();
  const [data, setData] = useState<ReportPayload | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    const r = store.getReport<ReportPayload>();
    const s = store.getSession();
    if (!r || !s) {
      router.replace("/dashboard");
      return;
    }
    setData(r);
    setSession(s);
  }, [router]);

  if (!data || !session) return null;
  const { report, aggregate } = data;

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">Back to dashboard</Button>
          </Link>
          <Link href="/interview">
            <Button variant="outline" size="sm">Run another interview</Button>
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

      <section className="mt-12">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
          Per-question detail
        </span>
        <div className="mt-4 space-y-2">
          {session.answers.map((a, i) => (
            <details
              key={i}
              className="group rounded-lg border border-ink-800 bg-ink-900/40 transition-colors hover:bg-ink-900/70"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-ink-500">
                    Q{i + 1} · {a.question.type.replace("_", " ")} · d
                    {a.question.difficulty}
                  </div>
                  <div className="mt-1 truncate text-sm text-ink-100">
                    {a.question.question}
                  </div>
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="font-mono text-2xl text-ink-50">
                    {Math.round(a.combined_score.technical)}
                  </span>
                  <span className="text-[10px] text-ink-500">tech</span>
                </div>
              </summary>
              <div className="grid grid-cols-1 gap-4 border-t border-ink-800 p-4 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-ink-500">
                    Transcript
                  </div>
                  <p className="text-xs text-ink-300">
                    {a.transcript || "(silent)"}
                  </p>
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-ink-500">
                    Eval
                  </div>
                  <p className="text-xs text-ink-300">
                    Correctness {a.evaluation.correctness_score} · Depth{" "}
                    {a.evaluation.depth_score}
                  </p>
                  {a.evaluation.missing_concepts.length > 0 && (
                    <p className="mt-1 text-xs text-ink-500">
                      Missed: {a.evaluation.missing_concepts.join(", ")}
                    </p>
                  )}
                  <p className="mt-2 text-xs italic text-ink-400">
                    Ideal: {a.evaluation.brief_ideal_answer}
                  </p>
                </div>
                <div className="space-y-2">
                  <ScoreMeter
                    label="Communication"
                    value={a.combined_score.communication}
                    accent
                  />
                  <ScoreMeter
                    label="Confidence"
                    value={a.combined_score.confidence}
                  />
                  <div className="font-mono text-[10px] text-ink-500">
                    {a.audio.speech_rate_wpm} wpm · {a.audio.hesitation_count} fillers ·{" "}
                    {Math.round(a.audio.duration_sec)}s
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
          Next steps
        </span>
        <ol className="mt-3 space-y-2">
          {report.next_steps.map((s, i) => (
            <li
              key={i}
              className="flex gap-3 rounded border border-ink-800 bg-ink-900/40 p-4 text-sm text-ink-200"
            >
              <span className="font-mono text-xs text-accent">
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

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4">
      <div className="text-[10px] uppercase tracking-widest text-ink-500">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl text-ink-50">
        {Math.round(value)}
      </div>
      <div className="mt-2">
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
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
      <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
        {title}
      </span>
      <ul className="mt-3 space-y-2">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-200">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent ? "bg-accent" : "bg-ink-400"}`}
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
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
          {title}
        </span>
        <span className="font-mono text-2xl text-ink-50">{Math.round(score)}</span>
      </div>
      {rows.map(([label, items]) => (
        <div key={label} className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-ink-500">
            {label}
          </div>
          <ul className="mt-1.5 space-y-1">
            {items.map((it, i) => (
              <li key={i} className="text-xs text-ink-300">
                · {it}
              </li>
            ))}
            {!items.length && <li className="text-xs text-ink-600">—</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
