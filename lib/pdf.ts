import { PDFParse } from "pdf-parse";

export async function extractPdfText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}
