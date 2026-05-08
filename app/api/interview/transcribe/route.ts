import { NextRequest, NextResponse } from "next/server";
import { DeepgramClient } from "@deepgram/sdk";
import { analyzeTranscript } from "@/lib/deepgram";

export const runtime = "nodejs";
export const maxDuration = 60;

// Server-side fallback: takes a recorded audio Blob, transcribes via Deepgram REST,
// and returns AudioMetrics. Used when streaming STT isn't available client-side.
export async function POST(req: NextRequest) {
  try {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) return NextResponse.json({ error: "no key" }, { status: 500 });

    const form = await req.formData();
    const file = form.get("audio") as File | null;
    const duration = Number(form.get("duration") ?? 0);
    if (!file) return NextResponse.json({ error: "no audio" }, { status: 400 });

    const dg = new DeepgramClient({ apiKey: key });
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await dg.listen.v1.media.transcribeFile(buf, {
      model: "nova-2",
      smart_format: true,
      filler_words: true,
      punctuate: true,
    });

    if (!("results" in result) || !result.results) {
      throw new Error("Deepgram returned no synchronous results");
    }

    const alt = result.results.channels?.[0]?.alternatives?.[0];
    const transcript = alt?.transcript ?? "";
    const wordConfs = (alt?.words ?? []).map(
      (w: { confidence?: number }) => w.confidence ?? 0.85,
    );
    const metrics = analyzeTranscript(transcript, duration || 30, wordConfs);

    return NextResponse.json({ metrics });
  } catch (err) {
    console.error("[transcribe]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 },
    );
  }
}
