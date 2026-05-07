import { NextRequest, NextResponse } from "next/server";
import { searchJobs } from "@/lib/jsearch";
import { generateJSON } from "@/lib/gemini";
import type { JobMatch, ResumeAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ScoredJob {
  job_id: string;
  match_score: number;
  match_reasons: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { resume: ResumeAnalysis; country?: string };
    const { resume, country = "us" } = body;

    // Pull jobs for top 2 inferred roles
    const queries = (resume.inferred_roles || [])
      .slice(0, 2)
      .map((r) => r.title);
    if (!queries.length) queries.push(resume.domain || "software engineer");

    const results = await Promise.all(
      queries.map((q) => searchJobs(q, country).catch(() => [])),
    );
    const merged = Array.from(
      new Map(results.flat().map((j) => [j.job_id, j])).values(),
    ).slice(0, 15);

    if (!merged.length) {
      return NextResponse.json({ jobs: [] });
    }

    const skillsList = [
      ...resume.skills.strong,
      ...resume.skills.moderate,
    ].join(", ");

    const prompt = `Given this candidate profile, score each job 0-100 for fit.

CANDIDATE:
- Seniority: ${resume.seniority}
- Domain: ${resume.domain}
- Experience: ${resume.experience_years} yrs
- Skills: ${skillsList}
- Target roles: ${queries.join(", ")}

JOBS (id|title|employer|description-snippet):
${merged
  .map(
    (j, i) =>
      `${i + 1}. ${j.job_id} | ${j.job_title} | ${j.employer_name} | ${(j.job_description || "").slice(0, 400).replace(/\s+/g, " ")}`,
  )
  .join("\n")}

Return JSON:
{
  "scored": [
    { "job_id": string, "match_score": number, "match_reasons": [3 short bullet strings explaining fit] }
  ]
}
Only include the top 10 jobs by match_score.`;

    const scored = await generateJSON<{ scored: ScoredJob[] }>({
      prompt,
      temperature: 0.2,
    });

    const byId = new Map(merged.map((j) => [j.job_id, j]));
    const jobs: JobMatch[] = scored.scored
      .map((s) => {
        const j = byId.get(s.job_id);
        if (!j) return null;
        return {
          job_id: j.job_id,
          job_title: j.job_title,
          employer_name: j.employer_name,
          job_city: j.job_city,
          job_country: j.job_country,
          job_employment_type: j.job_employment_type,
          job_apply_link: j.job_apply_link,
          job_description: j.job_description?.slice(0, 600),
          match_score: s.match_score,
          match_reasons: s.match_reasons,
        } satisfies JobMatch;
      })
      .filter(Boolean) as JobMatch[];

    jobs.sort((a, b) => b.match_score - a.match_score);
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error("[jobs/recommend]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
