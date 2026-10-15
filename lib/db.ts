import Dexie, { type Table } from "dexie";
import type {
  Book,
  Chapter,
  ReadingProgress,
  ReaderSettings,
} from "./types";

class ZenReaderDB extends Dexie {
  books!: Table<Book, string>;
  chapters!: Table<Chapter, string>;
  progress!: Table<ReadingProgress, string>;
  settings!: Table<{ id: string; reader: ReaderSettings }, string>;

  constructor() {
    super("zenreader");
    this.version(1).stores({
      books: "id, title, createdAt, lastReadAt",
      chapters: "id, bookId, index",
      progress: "bookId",
      settings: "id",
    });
  }
}

export const db = new ZenReaderDB();

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 19,
  fontFamily: "serif",
  lineHeight: 1.9,
  letterSpacing: 0.01,
  maxWidth: 720,
  theme: "dark",
};

export async function getReaderSettings(): Promise<ReaderSettings> {
  try {
    const row = await db.settings.get("reader");
    return row ? { ...DEFAULT_READER_SETTINGS, ...row.reader } : DEFAULT_READER_SETTINGS;
  } catch {
    // DB unavailable (very first ever load / private mode) — fall back to defaults.
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(reader: ReaderSettings): Promise<unknown> {
  return db.settings.put({ id: "reader", reader });
}

/** Delete a book together with all of its chapters and progress. */
export function deleteBook(bookId: string): Promise<unknown> {
  return db.transaction("rw", db.books, db.chapters, db.progress, async () => {
    await db.books.delete(bookId);
    await db.chapters.where("bookId").equals(bookId).delete();
    await db.progress.delete(bookId);
  });
}
