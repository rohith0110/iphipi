import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import type {
  AnswerEvaluation,
  AudioMetrics,
  InterviewQuestion,
  VisualMetrics,
} from "@/lib/types";
import { communicationScore, confidenceScore } from "@/lib/deepgram";

export const runtime = "nodejs";
export const maxDuration = 60;

interface EvalRequestBody {
  question: InterviewQuestion;
  transcript: string;
  audio: AudioMetrics;
  visual: VisualMetrics;
  role: string;
  resume_raw?: string;
  resume_skills?: string[];
}

interface CombinedResult extends AnswerEvaluation {
  cleaned_transcript: string;
}

const SYSTEM = `You are a senior hiring engineer evaluating a candidate's spoken answer to an interview question.

Two truths you must hold:

1. The transcript is from automatic speech-to-text. It MAY contain mishearings on technical terms — names of tools, frameworks, libraries, projects. The candidate's resume is the ground truth for what they actually built and use.

2. The "ideal answer" must be grounded in the candidate's actual stack as written in the resume. NEVER invent technologies, frameworks, or architectural details for the candidate. If the resume says they used Next.js + Convex + Clerk for project X, the ideal answer references those — not Flask, Firebase, or anything else.

You return ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  try {
    const {
      question,
      transcript,
      audio,
      visual,
      role,
      resume_raw,
      resume_skills,
    } = (await req.json()) as EvalRequestBody;

    const resumeBlock = resume_raw
      ? `CANDIDATE RESUME (verbatim — single source of truth for tech stack):
"""
${resume_raw.slice(0, 9000)}
"""
`
      : "";
    const skillsBlock = resume_skills?.length
      ? `Candidate-declared skills/tools (from resume): ${resume_skills.slice(0, 80).join(", ")}.\n`
      : "";

    const prompt = `${resumeBlock}${skillsBlock}
ROLE: ${role}
QUESTION (${question.type}, difficulty ${question.difficulty}/5): ${question.question}
EXPECTED KEYWORDS/CONCEPTS: ${question.expected_keywords.join(", ") || "(none)"}

RAW TRANSCRIBED ANSWER (from speech-to-text — likely contains misrecognised tech names):
"""
${transcript || "(no answer)"}
"""

STEP 1 — Reconcile the transcript.
- Read the raw transcript and compare against the resume.
- Replace obvious STT mishearings of tech names with their correct form (e.g. "Posthub" → "PostHog" if the resume mentions PostHog; "Converse"/"context"/"contact" → "Convex" if the resume mentions Convex; "art" → "Clerk" if the resume mentions Clerk; "NetShares"/"NextGen's"/"NextGear" → "Next.js" if the resume mentions Next.js; "fameman" → "framework"; etc.).
- Also lightly fix obvious whole-word misrecognitions when context makes them unambiguous.
- PRESERVE filler words ("um", "uh", "like"), false starts, and the candidate's general phrasing — do NOT make the answer sound smarter than it was.
- Do NOT add facts, technologies, or details the candidate didn't say. Only correct words you're confident were misheard.

STEP 2 — Evaluate the cleaned answer.
- Score correctness (0-100) and depth (0-100).
- "missing_concepts" = important things this question needed and the candidate omitted. Do NOT list a technology the candidate's resume doesn't mention as "missing" unless the question itself asked about that technology.
- "strengths" = up to 3 short bullets of what the candidate got right.
- "brief_ideal_answer" = 2-4 sentences. CRITICAL: Use ONLY technologies that appear in the resume for the relevant project. If the resume says they used Next.js + Convex + Clerk + Tailwind for the project being asked about, the ideal answer must reference those — never Flask, Express, Firebase, or anything not in the resume.
- "follow_up_if_weak" = a follow-up the interviewer should ask if score is low; "" if strong.

Return JSON:
{
  "cleaned_transcript": string,
  "correctness_score": number,
  "depth_score": number,
  "missing_concepts": string[],
  "strengths": string[],
  "brief_ideal_answer": string,
  "follow_up_if_weak": string
}`;

    const result = await generateJSON<CombinedResult>({
      prompt,
      systemInstruction: SYSTEM,
      temperature: 0.3,
    });

    const evaluation: AnswerEvaluation = {
      correctness_score: result.correctness_score,
      depth_score: result.depth_score,
      missing_concepts: result.missing_concepts,
      strengths: result.strengths,
      brief_ideal_answer: result.brief_ideal_answer,
      follow_up_if_weak: result.follow_up_if_weak,
    };

    const technical = (evaluation.correctness_score + evaluation.depth_score) / 2;
    const communication = communicationScore(audio);
    const confidence = confidenceScore(audio, visual);

    return NextResponse.json({
      evaluation,
      cleaned_transcript: result.cleaned_transcript || transcript,
      combined_score: { technical, communication, confidence },
    });
  } catch (err) {
    console.error("[interview/evaluate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
