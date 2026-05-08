import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf";
import { generateJSON } from "@/lib/gemini";
import type { ResumeAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are an expert technical recruiter. You analyse resumes and return ONLY valid JSON. No markdown, no prose.

CRITICAL FACTUAL RULES:
- The resume is your only source of truth. Do not invent technologies, frameworks, or details that aren't written there.
- A skill belongs in "strong" only if there's clear evidence (named project using it, role/duration, or measurable impact).
- A skill belongs in "moderate" if mentioned without strong evidence.
- "weak" must be reserved for skills the role typically expects but the resume LACKS — make it explicit in fit_reason that these are gaps, not claimed skills.
- "project_deep_dives" must use the project's exact name as written in the resume. Do not attribute any tech stack, framework, or architectural detail to a project unless it is explicitly stated in the resume.`;

const PROMPT = (resumeText: string) => `
Analyze this resume and return strictly this JSON shape:

{
  "candidate_name": string | null,
  "skills": { "strong": string[], "moderate": string[], "weak": string[] },
  "experience_years": number,
  "domain": "frontend" | "backend" | "fullstack" | "ml" | "data" | "devops" | "product" | "qa" | "mobile" | "embedded" | "other",
  "seniority": "intern" | "junior" | "mid" | "senior" | "staff",
  "inferred_roles": [
    {
      "title": string,
      "confidence": number,
      "fit_reason": string,
      "interview_focus": {
        "core_skills": string[],
        "probe_areas": string[],
        "project_deep_dives": string[]
      }
    }
  ]
}

Rules:
- Infer 3 to 5 realistic target roles the candidate could *actually get* given seniority and evidence.
- Skills classification is strict — see SYSTEM rules.
- "probe_areas" are concrete topics the interviewer should pressure-test, drawn from things the resume claims (so the candidate can defend them) — NOT things the resume doesn't mention.
- "project_deep_dives" entries must be the project's exact name from the resume. Do not invent a stack or scope. If a project's stack isn't in the resume, just list the name.
- Never fabricate a technology for a candidate. If their resume mentions "Aeon Techfest Website" without specifying the backend, do not assume Flask/Node/anything.

RESUME:
"""
${resumeText.slice(0, 12000)}
"""
`;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());

    let resumeText = "";
    if (file.name.toLowerCase().endsWith(".pdf") || file.type.includes("pdf")) {
      resumeText = await extractPdfText(buf);
    } else {
      resumeText = buf.toString("utf-8");
    }

    if (!resumeText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from resume" },
        { status: 400 },
      );
    }

    const analysis = await generateJSON<ResumeAnalysis>({
      prompt: PROMPT(resumeText),
      systemInstruction: SYSTEM,
      temperature: 0.3,
    });

    analysis.raw_text = resumeText;
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[resume/parse]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
