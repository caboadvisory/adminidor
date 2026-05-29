import { readFile } from "node:fs/promises";
import path from "node:path";

// @react-pdf/renderer's <Image> needs a raster source, so the PDF uses a PNG of
// the wordmark (not the SVG). Read it once and return a base64 data URI.
let cached: string | null | undefined;

export async function getPdfLogoDataUri(): Promise<string | undefined> {
  if (cached !== undefined) return cached ?? undefined;
  try {
    const file = path.join(process.cwd(), "public", "brand", "wordmark.png");
    const buf = await readFile(file);
    cached = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cached = null; // missing asset -> PDF falls back to the firm name text
  }
  return cached ?? undefined;
}
