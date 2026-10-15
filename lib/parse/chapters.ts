import type { ParsedChapter } from "../types";

/* ============================================================
   Chapter splitting & CJK-aware word counting
   ============================================================ */

/** Count words: every CJK character counts as one word; latin text
 *  is split on whitespace. */
export function countWords(text: string): number {
  const cjk = text.match(/[\u3400-\u9FFF]/g)?.length ?? 0;
  const nonCjk =
    text.replace(/[\u3400-\u9FFF]/g, " ").trim().split(/\s+/).filter(Boolean)
      .length ?? 0;
  return cjk + nonCjk;
}

/* Headings that mark a new chapter. */
const HEADING_PATTERNS: RegExp[] = [
  // Chapter 1 / CHAPTER ONE / Ch. 12 / Chapter XII (English & generic)
  /^\s*(?:chapter|ch(?:\.|apter)?)\s*([0-9]+|[IVXLCDM]+|[a-z]+)?\s*[:.\-—–]\s*.*$/i,
  /^\s*(?:chapter|ch(?:\.|apter)?)\s*([0-9]+|[IVXLCDM]+|[a-z]+)\s*$/i,
  // Bab 1 / Bagian 2 / Part 3 / Episode 4 (Indonesian & generic)
  /^\s*(?:bab|bagian|part|episode)\s*([0-9]+|[IVXLCDM]+|[a-z]+)\s*[:.\-—–]?\s*.*$/i,
  // 第1章 / 第一章 / 第 1 回 / 第12节 (CJK chapter markers)
  /^\s*第\s*[0-9０-９一二三四五六七八九十百千万零]+\s*[章卷节回話话]\s*.{0,60}$/,
  // Book 1 / Volume 2 / Vol. I (volume-level split)
  /^\s*(?:book|volume|vol\.?)\s*([0-9]+|[IVXLCDM]+)\s*[:.\-—–]?\s*.*$/i,
  // Standalone prologue / epilogue / interlude markers
  /^\s*(?:prologue|prolog|epilogue|epilog|interlude|afterword|foreword|前言|序章?|楔子|尾声|番外|间章|幕间|后记)\s*$/i,
  // 卷一 / 第二部 / 第一卷 (CJK volume/part markers)
  /^\s*[卷第]+\s*[0-9０-９一二三四五六七八九十百千]+\s*[部卷]?\s*.{0,40}$/,
];

/** If `line` looks like a chapter heading, return its cleaned title, else null. */
export function detectHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Tolerate markdown heading markers: "# Chapter 1" → "Chapter 1"
  const cleaned = trimmed.replace(/^#{1,6}\s*/, "");
  const candidate = cleaned && cleaned !== trimmed ? cleaned : trimmed;
  for (const re of HEADING_PATTERNS) {
    if (re.test(candidate)) return candidate;
  }
  return null;
}

export interface ParseChaptersOptions {
  /** Fallback target when the file has no detectable headings. */
  wordsPerChapter?: number;
  /** Prefix used for auto-generated fallback chapter titles. */
  chapterPrefix?: string;
}

const DEFAULT_WORDS_PER_CHAPTER = 3000;

/**
 * Split raw novel text into chapters.
 *
 * Paragraph detection:
 *  - When blank lines are the **dominant** separator (≥ 30% of text lines),
 *    consecutive non-empty lines are joined into a paragraph (this is
 *    hard-wrapped prose, e.g. converted PDFs/e-books).
 *  - Otherwise every non-empty line stays its own paragraph (the format
 *    produced by webnovel downloaders). A stray blank line here and there
 *    must NOT collapse the file into one giant paragraph.
 *
 * Chapter detection: explicit heading lines ("Chapter 1", "第1章"…) or,
 * when no headings exist at all, fallback chunking by word count.
 */
export function parseChapters(
  rawText: string,
  opts: ParseChaptersOptions = {}
): ParsedChapter[] {
  const wordsPerChapter = opts.wordsPerChapter ?? DEFAULT_WORDS_PER_CHAPTER;
  const prefix = opts.chapterPrefix ?? "Chapter";

  const text = rawText.replace(/\r\n?/g, "\n");
  if (!text.trim()) return [];

  /* Dominance check: is blank-line separation the file's real structure,
     or just an occasional empty line in an otherwise line-per-paragraph
     webnovel dump? */
  const splitLines = text.split("\n");
  let textLines = 0;
  let blankLines = 0;
  for (const l of splitLines) {
    if (l.trim()) textLines++;
    else blankLines++;
  }
  const blankSeparated = blankLines / Math.max(1, textLines) >= 0.3;

  /* --- 1. group lines into paragraphs (headings always stand alone) --- */
  const paragraphs: string[][] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) {
      paragraphs.push(buffer);
      buffer = [];
    }
  };
  for (const raw of splitLines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (detectHeading(line)) {
      flush();
      paragraphs.push([line]);
    } else if (blankSeparated) buffer.push(line);
    else paragraphs.push([line]);
  }
  flush();
  if (paragraphs.length === 0) return [];

  /* --- 2. split into chapters by heading lines --- */
  const blocks: { title: string; paras: string[][] }[] = [];
  let cur: { title: string; paras: string[][] } | null = null;

  for (const para of paragraphs) {
    const heading = detectHeading(para.join(" "));
    if (heading) {
      if (cur) blocks.push(cur);
      cur = { title: heading, paras: [] };
    } else {
      if (!cur) cur = { title: "", paras: [] };
      cur.paras.push(para);
    }
  }
  if (cur) blocks.push(cur);

  const hasHeadings = blocks.some((b) => b.title);

  /* --- 3. render helpers --- */
  const chapters: ParsedChapter[] = [];
  const pushChapter = (title: string, paras: string[][]) => {
    const parts: string[] = [];
    for (const para of paras) {
      const joined = joinParagraph(para);
      if (joined) parts.push(`<p>${escapeHtml(joined)}</p>`);
    }
    if (parts.length === 0) return; // skip empty chapters
    const content = parts.join("");
    chapters.push({
      title: title || `${prefix} ${chapters.length + 1}`,
      content,
      words: countWords(content.replace(/<[^>]+>/g, " ")),
    });
  };

  if (hasHeadings) {
    blocks.forEach((block, i) => {
      if (block.title) {
        pushChapter(block.title, block.paras);
      } else if (i === 0) {
        // Untitled content before the first heading becomes the prologue.
        pushChapter("Prologue", block.paras);
      } else {
        // Defensive: untitled block in the middle keeps an auto title.
        pushChapter(`${prefix} ${i + 1}`, block.paras);
      }
    });
  }

  /* --- 4. fallback: chunk paragraphs by word count --- */
  if (chapters.length === 0) {
    let chunk: string[][] = [];
    let chunkWords = 0;

    const emit = () => {
      if (chunk.length === 0) return;
      pushChapter(`${prefix} ${chapters.length + 1}`, chunk);
      chunk = [];
      chunkWords = 0;
    };

    for (const para of paragraphs) {
      const w = countWords(para.join(" "));
      if (w > wordsPerChapter && para.join(" ").length > 40) {
        // Oversized single paragraph (e.g. a whole novel on one line):
        // split it at sentence boundaries so chapters stay reasonable.
        for (const sub of splitParagraphByWords(para, wordsPerChapter)) {
          const sw = countWords(sub.join(" "));
          if (chunkWords + sw > wordsPerChapter && chunk.length > 0) emit();
          chunk.push(sub);
          chunkWords += sw;
        }
        continue;
      }
      if (chunkWords + w > wordsPerChapter && chunk.length > 0) emit();
      chunk.push(para);
      chunkWords += w;
    }
    emit();
  }

  return chapters;
}

/** Split an over-long paragraph into smaller pieces at sentence boundaries. */
function splitParagraphByWords(paraLines: string[], limit: number): string[][] {
  const text = joinParagraph(paraLines);
  const sentences =
    text.match(/[^。！？.!?]*[。！？.!?]+|[^。！？.!?]+$/g) ?? [text];
  const out: string[][] = [];
  let cur: string[] = [];
  let curWords = 0;
  const joinWith = /[\u3400-\u9FFF]/.test(text) ? "" : " ";

  for (const s of sentences) {
    const w = countWords(s);
    if (curWords + w > limit && cur.length > 0) {
      out.push([cur.join(joinWith)]);
      cur = [];
      curWords = 0;
    }
    cur.push(s);
    curWords += w;
    // Safety: extremely long sentences get hard-cut instead of one giant piece.
    if (curWords >= limit * 1.5) {
      out.push([cur.join(joinWith)]);
      cur = [];
      curWords = 0;
    }
  }
  if (cur.length > 0) out.push([cur.join(joinWith)]);
  return out;
}

/* ---------- helpers ---------- */

function joinParagraph(lines: string[]): string {
  if (lines.length === 1) return lines[0];
  // Don't insert spaces when joining CJK text.
  const hasCjk = lines.some((l) => /[\u3400-\u9FFF]/.test(l));
  return lines.join(hasCjk ? "" : " ");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
