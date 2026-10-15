import type { FileFormat, ParsedBook, ParseProgress } from "../types";
import { titleFromFileName } from "../utils";

const SUPPORTED: Record<string, FileFormat> = {
  txt: "txt",
  md: "md",
  epub: "epub",
  pdf: "pdf",
};

export function isSupportedFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext in SUPPORTED;
}

/** Parse any supported file into a normalized book. PDF is lazy-loaded. */
export async function parseFile(
  file: File,
  onProgress?: (p: ParseProgress) => void
): Promise<ParsedBook> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const fallbackTitle = titleFromFileName(file.name);

  switch (SUPPORTED[ext]) {
    case "txt":
    case "md": {
      const { parseTxt } = await import("./txt");
      return parseTxt(await file.text(), fallbackTitle);
    }
    case "epub": {
      const { parseEpub, dedupeChapterTitles } = await import("./epub");
      const parsed = await parseEpub(file, fallbackTitle);
      parsed.chapters = dedupeChapterTitles(parsed.chapters, parsed.title);
      if (!parsed.title) parsed.title = fallbackTitle;
      return parsed;
    }
    case "pdf": {
      const { parsePdf } = await import("./pdf");
      const parsed = await parsePdf(file, onProgress);
      parsed.title = fallbackTitle;
      return parsed;
    }
    default:
      throw new Error(`Unsupported file format: .${ext || "?"}`);
  }
}

export function totalWords(chapters: { words: number }[]): number {
  return chapters.reduce((sum, c) => sum + (c.words ?? 0), 0);
}
