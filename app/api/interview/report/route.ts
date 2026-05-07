import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import type { FinalReport, InterviewSession } from "@/lib/types";
import { avg } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { session } = (await req.json()) as { session: InterviewSession };

    const technical = avg(session.answers.map((a) => a.combined_score.technical));
    const communication = avg(session.answers.map((a) => a.combined_score.communication));
    const confidence = avg(session.answers.map((a) => a.combined_score.confidence));

    const summary = session.answers
      .map(
        (a, i) =>
          `Q${i + 1} [${a.question.type}, d${a.question.difficulty}]: ${a.question.question}\n  Answer transcript: ${a.transcript.slice(0, 400)}\n  Eval: correctness=${a.evaluation.correctness_score}, depth=${a.evaluation.depth_score}, missing=${a.evaluation.missing_concepts.join("|")}\n  Audio: wpm=${a.audio.speech_rate_wpm}, fillers=${a.audio.hesitation_count}, conf=${a.audio.confidence.toFixed(2)}\n  Visual: engagement=${a.visual.engagement.toFixed(2)}, composure=${a.visual.composure.toFixed(2)}, stress=${a.visual.stress_level.toFixed(2)}`,
      )
      .join("\n\n");

    const prompt = `Generate an end-of-interview feedback report.

ROLE: ${session.targetRole}
CANDIDATE seniority: ${session.resume.seniority}
Aggregate scores: technical=${technical.toFixed(0)} communication=${communication.toFixed(0)} confidence=${confidence.toFixed(0)}

Per-question detail:
${summary}

Return JSON:
{
  "overall_score": number,                            // 0-100, weighted: 0.5*technical + 0.25*communication + 0.25*confidence
  "hire_recommendation": "strong_yes" | "yes" | "maybe" | "no",
  "technical_summary": { "score": number, "strengths": string[], "gaps": string[], "study_topics": string[] },
  "communication_summary": { "score": number, "observations": string[], "tips": string[] },
  "confidence_summary": { "score": number, "observations": string[], "tips": string[] },
  "top_3_improvements": string[],
  "top_3_strengths": string[],
  "next_steps": string[]
}
Make every bullet specific to this candidate's actual answers. Avoid generic advice.`;

    const report = await generateJSON<FinalReport>({ prompt, temperature: 0.4 });
    return NextResponse.json({
      report,
      aggregate: { technical, communication, confidence },
    });
  } catch (err) {
    console.error("[interview/report]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
