import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let _client: GoogleGenAI | null = null;
export function getGemini() {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in .env.local");
  }
  if (!_client) _client = new GoogleGenAI({ apiKey });
  return _client;
}

export interface JsonGenOpts {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
}

function stripCodeFence(s: string) {
  return s
    .trim()
    .replace(/^```(?:json|JSON)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export async function generateJSON<T = unknown>(opts: JsonGenOpts): Promise<T> {
  const client = getGemini();
  const res = await client.models.generateContent({
    model,
    contents: opts.prompt,
    config: {
      systemInstruction:
        opts.systemInstruction ??
        "You are a precise assistant. Respond with ONLY valid JSON. No markdown code fences. No prose.",
      temperature: opts.temperature ?? 0.4,
      responseMimeType: "application/json",
    },
  });
  const txt = (res.text ?? "").toString();
  const cleaned = stripCodeFence(txt);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Best-effort: extract first JSON object
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error(`Gemini returned non-JSON output: ${txt.slice(0, 200)}`);
  }
}

export async function generateText(prompt: string, system?: string) {
  const client = getGemini();
  const res = await client.models.generateContent({
    model,
    contents: prompt,
    config: { systemInstruction: system, temperature: 0.7 },
  });
  return (res.text ?? "").toString();
}
