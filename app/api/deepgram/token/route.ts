import { NextResponse } from "next/server";

export const runtime = "nodejs";

// For the hackathon we return the API key directly to the browser.
// In production swap to Deepgram's `keys/short-lived` endpoint.
export async function GET() {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY not set" }, { status: 500 });
  }
  return NextResponse.json({ key });
}
