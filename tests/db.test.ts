import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db";
import { importBookFile } from "@/lib/importer";
import { deleteBook } from "@/lib/db";
import { uid } from "@/lib/utils";

beforeAll(async () => {
  await db.open();
});

beforeEach(async () => {
  await db.books.clear();
  await db.chapters.clear();
  await db.progress.clear();
  await db.settings.clear();
});

describe("importBookFile → IndexedDB round trip", () => {
  it("stores book, chapters and initial progress for a txt file", async () => {
    const file = new File(
      [
        "Chapter 1\nOnce upon a time, in a land far away.\n\n" +
          "Chapter 2\nThe hero finally arrived.\n",
      ],
      "my_story.txt",
      { type: "text/plain" }
    );

    const book = await importBookFile(file);

    expect(book.title).toBe("my story"); // cleaned from file name
    expect(book.fileName).toBe("my_story.txt");
    expect(book.fileFormat).toBe("txt");
    expect(book.chapterCount).toBe(2);
    expect(book.totalWords).toBeGreaterThan(0);

    const fromDb = await db.books.get(book.id);
    expect(fromDb?.chapterCount).toBe(2);

    const chapters = await db.chapters
      .where("bookId")
      .equals(book.id)
      .sortBy("index");
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Chapter 1");
    expect(chapters[0].content).toContain("land far away");
    expect(chapters[0].id).toBe(`${book.id}:0`);

    const progress = await db.progress.get(book.id);
    expect(progress?.chapterIndex).toBe(0);
    expect(progress?.scrollPercent).toBe(0);
  });

  it("handles markdown files with heading detection", async () => {
    const file = new File(["# Chapter 1\nHello world.\n"], "doc.md", {
      type: "text/markdown",
    });
    const book = await importBookFile(file);
    expect(book.fileFormat).toBe("md");
    const chapters = await db.chapters.where("bookId").equals(book.id).toArray();
    expect(chapters[0].title).toBe("Chapter 1"); // markdown marker stripped
    expect(chapters[0].content).toContain("Hello world");
  });

  it("rejects unsupported formats with a clear error", async () => {
    const file = new File(["x"], "evil.exe", { type: "application/octet-stream" });
    await expect(importBookFile(file)).rejects.toThrow("Unsupported format");
  });

  it("is idempotent: importing twice creates two separate books", async () => {
    const make = () =>
      new File(["Chapter 1\nText.\n"], `book_${uid()}.txt`, { type: "text/plain" });
    const a = await importBookFile(make());
    const b = await importBookFile(make());
    expect(a.id).not.toBe(b.id);
    expect((await db.books.toArray()).length).toBe(2);
  });

  it("deleteBook removes the book and all related rows", async () => {
    const file = new File(["Chapter 1\nText.\nChapter 2\nMore.\n"], "x.txt", {
      type: "text/plain",
    });
    const book = await importBookFile(file);
    await db.progress.put({
      bookId: book.id,
      chapterIndex: 1,
      scrollPercent: 42,
      updatedAt: Date.now(),
    });

    await deleteBook(book.id);

    expect(await db.books.get(book.id)).toBeUndefined();
    expect(
      (await db.chapters.where("bookId").equals(book.id).toArray()).length
    ).toBe(0);
    expect(await db.progress.get(book.id)).toBeUndefined();
  });

  it("persists and restores reader settings", async () => {
    const { getReaderSettings, saveReaderSettings } = await import("@/lib/db");
    await saveReaderSettings({
      fontSize: 24,
      fontFamily: "sans",
      lineHeight: 2.2,
      letterSpacing: 0.05,
      maxWidth: 800,
      theme: "sepia",
    });
    const restored = await getReaderSettings();
    expect(restored.theme).toBe("sepia");
    expect(restored.fontSize).toBe(24);
  });
});
