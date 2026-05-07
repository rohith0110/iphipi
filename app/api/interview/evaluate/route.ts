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

export async function POST(req: NextRequest) {
  try {
    const {
      question,
      transcript,
      audio,
      visual,
      role,
    } = (await req.json()) as {
      question: InterviewQuestion;
      transcript: string;
      audio: AudioMetrics;
      visual: VisualMetrics;
      role: string;
    };

    const prompt = `Evaluate this interview answer.

ROLE: ${role}
QUESTION (${question.type}, difficulty ${question.difficulty}/5): ${question.question}
EXPECTED KEYWORDS/CONCEPTS: ${question.expected_keywords.join(", ") || "(none)"}

CANDIDATE ANSWER (transcribed):
"""
${transcript || "(no answer)"}
"""

Return JSON:
{
  "correctness_score": number,        // 0-100
  "depth_score": number,              // 0-100
  "missing_concepts": string[],       // important things the candidate omitted
  "strengths": string[],              // up to 3 short bullets
  "brief_ideal_answer": string,       // 2-4 sentence ideal answer
  "follow_up_if_weak": string         // a follow-up the interviewer should ask if score is low; "" if strong
}
Be strict but fair. If the transcript is empty or off-topic, score low and explain.`;

    const evaluation = await generateJSON<AnswerEvaluation>({
      prompt,
      temperature: 0.3,
    });

    const technical = (evaluation.correctness_score + evaluation.depth_score) / 2;
    const communication = communicationScore(audio);
    const confidence = confidenceScore(audio, visual);

    return NextResponse.json({
      evaluation,
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
