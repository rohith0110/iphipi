"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ResumeUpload } from "@/components/dashboard/ResumeUpload";
import { RoleCard } from "@/components/dashboard/RoleCard";
import { JobCard } from "@/components/dashboard/JobCard";
import { store } from "@/lib/session-store";
import type { JobMatch, ResumeAnalysis, InterviewSession } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeAnalysis | null>(null);
  const [jobs, setJobs] = useState<JobMatch[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const r = store.getResume();
    if (r) {
      setResume(r);
      setSelectedRole(r.inferred_roles?.[0]?.title ?? null);
    }
    const j = store.getJobs();
    if (j) setJobs(j);
  }, []);

  async function handleParsed(r: ResumeAnalysis) {
    setResume(r);
    store.setResume(r);
    setSelectedRole(r.inferred_roles?.[0]?.title ?? null);
    setJobsLoading(true);
    try {
      const res = await fetch("/api/jobs/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: r }),
      });
      const data = await res.json();
      if (res.ok) {
        setJobs(data.jobs);
        store.setJobs(data.jobs);
      }
    } finally {
      setJobsLoading(false);
    }
  }

  function startInterview() {
    if (!resume || !selectedRole) return;
    setStarting(true);
    const session: InterviewSession = {
      id: `s_${Date.now()}`,
      startedAt: Date.now(),
      resume,
      targetRole: selectedRole,
      difficultyLevel: 3,
      questions: [],
      answers: [],
      status: "active",
    };
    store.setSession(session);
    router.push("/interview");
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-32">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            store.clear();
            location.reload();
          }}
        >
          Reset
        </Button>
      </header>

      {!resume ? (
        <section className="mx-auto max-w-2xl pt-16">
          <div className="mb-8">
            <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
              §01 · ingestion
            </span>
            <h1 className="mt-3 font-display text-4xl tracking-tight text-ink-50">
              Start with your resume.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-400">
              We extract your skills, infer the roles you can realistically
              land, and pull live job postings ranked by fit.
            </p>
          </div>
          <ResumeUpload onParsed={handleParsed} />
        </section>
      ) : (
        <div className="space-y-16 pt-8">
          {/* Resume summary */}
          <section>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
                  §01 · profile
                </span>
                <h2 className="mt-2 font-display text-3xl tracking-tight text-ink-50">
                  {resume.candidate_name ?? "Candidate"}
                </h2>
              </div>
              <div className="flex items-center gap-6 text-right">
                <Stat label="seniority" value={resume.seniority} />
                <Stat label="years" value={String(resume.experience_years)} />
                <Stat label="domain" value={resume.domain} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-px bg-ink-800 sm:grid-cols-3">
              <SkillBlock label="Strong" tone="accent" items={resume.skills.strong} />
              <SkillBlock label="Moderate" tone="neutral" items={resume.skills.moderate} />
              <SkillBlock label="Probe areas" tone="muted" items={resume.skills.weak} />
            </div>
          </section>

          {/* Role selection */}
          <section>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
                  §02 · target role
                </span>
                <h2 className="mt-2 font-display text-3xl tracking-tight text-ink-50">
                  Pick what you&apos;re training for.
                </h2>
              </div>
              <Button
                variant="accent"
                size="lg"
                onClick={startInterview}
                disabled={!selectedRole}
                loading={starting}
              >
                <Sparkles className="h-4 w-4" />
                Start adaptive interview
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {resume.inferred_roles.map((r) => (
                <RoleCard
                  key={r.title}
                  role={r}
                  selected={selectedRole === r.title}
                  onSelect={() => setSelectedRole(r.title)}
                />
              ))}
            </div>
          </section>

          {/* Jobs */}
          <section>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-ink-500">
                  §03 · live postings
                </span>
                <h2 className="mt-2 font-display text-3xl tracking-tight text-ink-50">
                  Jobs ranked against you.
                </h2>
              </div>
              {jobsLoading && (
                <span className="inline-flex items-center gap-2 text-xs text-ink-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  fetching matches…
                </span>
              )}
            </div>
            {jobs && jobs.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {jobs.map((j) => (
                  <JobCard key={j.job_id} job={j} />
                ))}
              </div>
            ) : !jobsLoading ? (
              <div className="rounded border border-ink-800 bg-ink-900/40 p-8 text-center text-sm text-ink-500">
                No jobs returned. Try resetting or uploading a more detailed resume.
              </div>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-500">{label}</div>
      <div className="font-mono text-sm text-ink-100">{value}</div>
    </div>
  );
}

function SkillBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "accent" | "neutral" | "muted";
}) {
  const dot =
    tone === "accent"
      ? "bg-accent"
      : tone === "neutral"
        ? "bg-ink-300"
        : "bg-ink-600";
  return (
    <div className="bg-ink-950 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] uppercase tracking-widest text-ink-500">
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((s) => (
            <span
              key={s}
              className="rounded-sm border border-ink-800 bg-ink-900/60 px-2 py-1 text-xs text-ink-200"
            >
              {s}
            </span>
          ))
        ) : (
          <span className="text-xs text-ink-600">—</span>
        )}
      </div>
    </div>
  );
}
