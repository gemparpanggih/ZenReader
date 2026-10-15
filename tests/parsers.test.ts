import { describe, expect, it } from "vitest";
import { isSupportedFile, totalWords } from "@/lib/parse";
import { parseTxt } from "@/lib/parse/txt";
import { groupIntoLines } from "@/lib/parse/pdf";
import { titleFromFileName } from "@/lib/utils";

describe("parseTxt", () => {
  it("parses a simple novel with chapter headings", () => {
    const book = parseTxt(
      "Chapter 1\nHello world.\n\nChapter 2\nThe end.",
      "novel.txt"
    );
    expect(book.title).toBe("novel.txt");
    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0].title).toBe("Chapter 1");
  });

  it("handles windows line endings", () => {
    const book = parseTxt("Chapter 1\r\nHello.\r\n", "w.txt");
    expect(book.chapters).toHaveLength(1);
    expect(book.chapters[0].content).toContain("Hello");
  });
});

describe("isSupportedFile", () => {
  it("accepts supported extensions case-insensitively", () => {
    expect(isSupportedFile("novel.txt")).toBe(true);
    expect(isSupportedFile("novel.TXT")).toBe(true);
    expect(isSupportedFile("novel.md")).toBe(true);
    expect(isSupportedFile("novel.epub")).toBe(true);
    expect(isSupportedFile("novel.pdf")).toBe(true);
  });

  it("rejects others", () => {
    expect(isSupportedFile("novel.docx")).toBe(false);
    expect(isSupportedFile("novel")).toBe(false);
  });
});

describe("totalWords", () => {
  it("sums chapter word counts", () => {
    expect(totalWords([{ words: 10 }, { words: 5 }])).toBe(15);
  });
});

describe("titleFromFileName", () => {
  it("cleans extensions and separators", () => {
    expect(titleFromFileName("the-hidden_city.v2.txt")).toBe("the hidden city v2");
    expect(titleFromFileName("novel.pdf")).toBe("novel");
    expect(titleFromFileName("---")).toBe("Untitled");
  });
});

describe("groupIntoLines (pdf helper)", () => {
  it("sorts items into lines by baseline y, then x", () => {
    const items = [
      { str: "world", transform: [1, 0, 0, 1, 60, 40] },
      { str: "Hello", transform: [1, 0, 0, 1, 10, 40] },
      { str: "second", transform: [1, 0, 0, 1, 10, 80] },
    ];
    expect(groupIntoLines(items)).toEqual(["Hello world", "second"]);
  });

  it("drops empty cells", () => {
    expect(groupIntoLines([{ str: "  ", transform: [1, 0, 0, 1, 0, 0] }])).toEqual([]);
  });
});
