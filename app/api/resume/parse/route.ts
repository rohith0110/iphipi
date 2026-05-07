import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf";
import { generateJSON } from "@/lib/gemini";
import type { ResumeAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are an expert technical recruiter. You analyse resumes and return ONLY valid JSON. No markdown, no prose.`;

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
- "weak" skills are areas the resume claims but provides little evidence for, OR adjacent skills the role expects but resume lacks.
- "probe_areas" are concrete topics the interviewer should pressure-test.
- "project_deep_dives" should reference real projects from the resume by name.

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
