import type { ParsedBook, ParsedChapter } from "../types";
import { parseChapters } from "./chapters";

/**
 * Parse a plain-text novel (.txt / .md).
 * Chapter headings are detected automatically; if none are found the
 * text is chunked into ~3000-word chapters.
 */
export function parseTxt(rawText: string, fileName: string): ParsedBook {
  const chapters: ParsedChapter[] = parseChapters(rawText);
  return {
    title: fileName,
    chapters,
  };
}
