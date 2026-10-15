import * as pdfjs from "pdfjs-dist";
import type { ParsedBook, ParseProgress } from "../types";
import { parseChapters } from "./chapters";

/* ============================================================
   PDF parsing (client-side only; uses pdf.js with a worker).
   ============================================================ */

let workerReady: Promise<void> | null = null;

async function ensurePdfWorker(): Promise<void> {
  if (workerReady) return workerReady;
  workerReady = (async () => {
    const workerUrl = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    );
    const worker = new Worker(workerUrl, { type: "module" });
    pdfjs.GlobalWorkerOptions.workerPort = worker;
  })();
  return workerReady;
}

interface TextCell {
  x: number;
  str: string;
}

/** Group pdf.js text items into physical lines (by baseline y). */
export function groupIntoLines(items: { str: string; transform: number[] }[]): string[] {
  const byY = new Map<number, TextCell[]>();
  for (const it of items) {
    const str = (it.str ?? "").trim();
    if (!str) continue;
    const y = Math.round(it.transform[5] * 2) / 2;
    const list = byY.get(y) ?? [];
    list.push({ x: it.transform[4], str });
    byY.set(y, list);
  }
  return [...byY.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, cells]) =>
      cells
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join(" ")
    );
}

async function renderFirstPageCover(
  doc: pdfjs.PDFDocumentProxy
): Promise<Blob | null> {
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 0.55 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8)
    );
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } catch {
    return null; // cover extraction is best-effort
  }
}

/**
 * Extract text from a PDF and split it into chapters (using the same
 * heading detection / word-count fallback as .txt files).
 */
export async function parsePdf(
  file: Blob,
  onProgress?: (p: ParseProgress) => void
): Promise<ParsedBook> {
  await ensurePdfWorker();

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data,
    // CJK PDFs often rely on Adobe CMaps (cMapPacked .bcmap files are
    // copied to public/pdfjs/ by scripts/sync-pdfjs-assets.mjs).
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });
  const doc = await loadingTask.promise;

  try {
    const cover = await renderFirstPageCover(doc);

    const pages: string[] = [];
    const total = doc.numPages;
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const lines = groupIntoLines(textContent.items as { str: string; transform: number[] }[]);
      if (lines.length > 0) pages.push(lines.join("\n"));
      onProgress?.({ page: i, total });
    }

    const chapters = parseChapters(pages.join("\n\n"));
    if (chapters.length === 0) {
      throw new Error("No readable text found in this PDF");
    }

    return {
      title: "",
      cover,
      chapters,
    };
  } finally {
    void loadingTask.destroy().catch(() => undefined);
  }
}
