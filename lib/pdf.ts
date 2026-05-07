// pdf-parse import is intentionally lazy because it inspects index.js at module init.
export async function extractPdfText(buf: Buffer): Promise<string> {
  // @ts-expect-error - pdf-parse has CJS shape; we import the lib file directly to avoid debug code path
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    b: Buffer,
  ) => Promise<{ text: string }>;
  const out = await pdfParse(buf);
  return out.text || "";
}
