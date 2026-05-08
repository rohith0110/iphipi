"use client";
import { ExternalLink, MapPin, Building2 } from "lucide-react";
import type { JobMatch } from "@/lib/types";

export function JobCard({ job }: { job: JobMatch }) {
  return (
    <a
      href={job.job_apply_link}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-ink-800 bg-ink-900/40 p-5 transition-all duration-200 cursor-pointer hover:border-ink-600 hover:bg-ink-900/70 active:scale-[0.995]"
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-lg text-ink-50">
            {job.job_title}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {job.employer_name}
            </span>
            {job.job_city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.job_city}
                {job.job_country ? `, ${job.job_country}` : ""}
              </span>
            )}
            {job.job_employment_type && (
              <span className="rounded-sm border border-ink-700 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ink-300">
                {job.job_employment_type}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-baseline gap-1">
          <span className="font-mono text-3xl leading-none text-accent">
            {job.match_score}
          </span>
          <span className="text-[11px] text-ink-500">/100</span>
        </div>
      </div>

      <ul className="mt-3 space-y-2 border-t border-ink-800 pt-3">
        {job.match_reasons.slice(0, 3).map((r, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-200">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
            {r}
          </li>
        ))}
      </ul>

      <div className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-ink-400 transition-colors group-hover:text-ink-100">
        Apply
        <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </a>
  );
}
