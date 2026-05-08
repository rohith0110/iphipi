import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import type { InterviewQuestion, InterviewSession } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are a senior hiring engineer conducting an adaptive technical interview. You return ONLY valid JSON.

CRITICAL FACTUAL GROUNDING RULE:
- The candidate's resume is the ONLY source of truth for what they have built or used.
- NEVER invent technologies, frameworks, languages, libraries, or architectural details for a candidate's project. If the resume does not state which stack a project uses, you must NOT assume one.
- For project_deep_dive questions: anchor the question in the resume's literal description of the project. If a detail (stack, scale, role) isn't written in the resume, either omit it from the question or ask the candidate to describe it themselves ("Walk me through the stack you used for X" rather than "your Python/Flask backend for X").
- Do not synthesize composite projects. If the resume mentions Project A and Project B, do not blend them.
- "Weak/probe areas" are skills the role typically expects but the resume LACKS evidence of — when probing them, frame as a general technical question, NEVER as if the candidate has worked with that skill.`;

export async function POST(req: NextRequest) {
  try {
    const { session } = (await req.json()) as { session: InterviewSession };

    const lastAnswer = session.answers[session.answers.length - 1];
    const lastEval = lastAnswer
      ? `Last answer scored ${lastAnswer.evaluation.correctness_score}/100 correctness, ${lastAnswer.evaluation.depth_score}/100 depth. Missing: ${lastAnswer.evaluation.missing_concepts.join(", ") || "none"}.`
      : "This is the first question.";

    const askedTypes = session.questions.map((q) => q.type).join(", ") || "none";
    const askedSummary =
      session.questions
        .map((q, i) => `${i + 1}. [${q.type}] ${q.question}`)
        .join("\n") || "(no prior questions)";

    const focusRole = session.resume.inferred_roles.find(
      (r) => r.title === session.targetRole,
    );

    const focus = focusRole
      ? `Core skills: ${focusRole.interview_focus.core_skills.join(", ")}. Probe: ${focusRole.interview_focus.probe_areas.join(", ")}. Projects: ${focusRole.interview_focus.project_deep_dives.join(", ")}.`
      : "";

    const resumeText = (session.resume.raw_text ?? "").slice(0, 9000);

    const prompt = `Conduct an interview for the role: ${session.targetRole}.
Candidate seniority: ${session.resume.seniority}.
Strong skills (resume-evidenced): ${session.resume.skills.strong.join(", ")}.
Weak/probe areas (NOT claimed by candidate — frame as general questions only): ${session.resume.skills.weak.join(", ")}.
${focus}

CANDIDATE RESUME (verbatim — your single source of truth for project details):
"""
${resumeText}
"""

Question history:
${askedSummary}

Adaptation signal: ${lastEval}
Current difficulty (1-5): ${session.difficultyLevel}
Question types asked so far: ${askedTypes}

Adapt rules:
- If last answer < 40 correctness: lower difficulty by 1, ask a foundational concept question, include warm encouragement.
- If last answer > 80 correctness: raise difficulty by 1, ask a system-design or edge-case question.
- Don't repeat question topics. Mix types: technical, behavioral, system_design, project_deep_dive (and at least one behavioral in 6).
- Keep total interview to ~6-8 questions; questions should be 1-2 sentences.

Grounding rules (HARD — violating these makes the question invalid):
- For project_deep_dive: name the project EXACTLY as it appears in the resume; do not attribute any technology, framework, or architectural detail to the project unless that exact tech/detail appears verbatim in the resume.
- If you want to know about a stack the resume doesn't disclose, ask the candidate to describe it (e.g. "Walk me through the architecture you used for <ProjectName>" — never "your <Tech> backend for <ProjectName>").
- For technical questions about probe areas: ask them as standalone concept questions, never phrased as "in your <X> work".

Return JSON:
{
  "question": string,
  "type": "technical" | "behavioral" | "system_design" | "coding" | "project_deep_dive",
  "expected_keywords": string[],
  "difficulty": number,
  "encouragement": string | null,
  "should_end": boolean
}`;

    const out = await generateJSON<{
      question: string;
      type: InterviewQuestion["type"];
      expected_keywords: string[];
      difficulty: number;
      encouragement: string | null;
      should_end: boolean;
    }>({ prompt, systemInstruction: SYSTEM, temperature: 0.7 });

    if (out.should_end || session.questions.length >= 8) {
      return NextResponse.json({ done: true });
    }

    const question: InterviewQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      question: out.question,
      type: out.type,
      expected_keywords: out.expected_keywords ?? [],
      difficulty: out.difficulty ?? session.difficultyLevel,
      encouragement: out.encouragement,
      index: session.questions.length,
    };

    return NextResponse.json({ done: false, question });
  } catch (err) {
    console.error("[interview/question]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
