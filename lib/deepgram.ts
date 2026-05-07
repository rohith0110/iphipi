// Deepgram helper. Browser uses an ephemeral key fetched from /api/deepgram/token.
// Server-side scoring lives here.
import type { AudioMetrics } from "./types";

const FILLERS = [
  "um",
  "uh",
  "uhm",
  "er",
  "ah",
  "like",
  "you know",
  "i mean",
  "basically",
  "actually",
  "so",
  "kinda",
  "sorta",
];

export function analyzeTranscript(
  transcript: string,
  durationSec: number,
  wordConfidences?: number[],
): AudioMetrics {
  const cleaned = transcript.toLowerCase().replace(/[^a-z\s']/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const total = words.length || 1;

  let fillerCount = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`\\b${f.replace(" ", "\\s+")}\\b`, "g");
    fillerCount += (cleaned.match(re) || []).length;
  }

  const minutes = Math.max(durationSec, 1) / 60;
  const wpm = Math.round(total / minutes);
  const confidence = wordConfidences?.length
    ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length
    : 0.85;

  return {
    transcription: transcript,
    confidence,
    hesitation_count: fillerCount,
    speech_rate_wpm: wpm,
    filler_word_ratio: fillerCount / total,
    duration_sec: durationSec,
  };
}

export function communicationScore(m: AudioMetrics): number {
  const hesitationPenalty = Math.min(35, m.hesitation_count * 3);
  // Ideal pace 110-160 WPM
  const paceScore =
    m.speech_rate_wpm >= 110 && m.speech_rate_wpm <= 160
      ? 30
      : m.speech_rate_wpm < 80 || m.speech_rate_wpm > 200
        ? 8
        : 18;
  const clarity = m.confidence * 40;
  const fluency = (1 - Math.min(1, m.filler_word_ratio * 5)) * 30;
  return Math.max(0, Math.min(100, clarity + paceScore + fluency - hesitationPenalty));
}

export function confidenceScore(audio: AudioMetrics, visual?: { composure: number; engagement: number; stress_level: number }): number {
  const audioConfidence = audio.confidence * 50 - audio.filler_word_ratio * 100;
  const visualConfidence = visual
    ? visual.engagement * 25 + visual.composure * 25 - visual.stress_level * 20
    : 25;
  return Math.max(0, Math.min(100, audioConfidence + visualConfidence + 30));
}
