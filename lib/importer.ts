import { db } from "./db";
import { parseFile, totalWords, isSupportedFile } from "./parse";
import { titleFromFileName, uid } from "./utils";
import type { Book, FileFormat } from "./types";

export type ImportStage = "parsing" | "saving";

/**
 * Parse a local novel file and persist it (book + chapters + progress)
 * into IndexedDB in one transaction.
 */
export async function importBookFile(
  file: File,
  onStage?: (stage: ImportStage, percent?: number) => void
): Promise<Book> {
  if (!isSupportedFile(file.name)) {
    throw new Error(`Unsupported format: ${file.name.split(".").pop() ?? "?"}`);
  }

  const parsed = await parseFile(file, (p) =>
    onStage?.("parsing", Math.round((p.page / p.total) * 100))
  );

  if (parsed.chapters.length === 0) {
    throw new Error("No readable content found in this file");
  }
  onStage?.("saving");

  const id = uid();
  const ext = (file.name.split(".").pop() ?? "txt").toLowerCase() as FileFormat;
  const now = Date.now();

  const book: Book = {
    id,
    title: parsed.title || titleFromFileName(file.name),
    author: parsed.author,
    genre: "",
    description: parsed.description,
    cover: parsed.cover ?? null,
    fileFormat: ext,
    fileName: file.name,
    chapterCount: parsed.chapters.length,
    totalWords: totalWords(parsed.chapters),
    createdAt: now,
    lastReadAt: now,
  };

  const chapters = parsed.chapters.map((c, i) => ({
    id: `${id}:${i}`,
    bookId: id,
    index: i,
    title: c.title,
    content: c.content,
    words: c.words,
  }));

  await db.transaction("rw", db.books, db.chapters, db.progress, async () => {
    await db.books.put(book);
    await db.chapters.bulkPut(chapters);
    await db.progress.put({
      bookId: id,
      chapterIndex: 0,
      scrollPercent: 0,
      updatedAt: now,
    });
  });

  return book;
}
