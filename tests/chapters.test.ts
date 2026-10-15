import { describe, expect, it } from "vitest";
import {
  countWords,
  detectHeading,
  parseChapters,
} from "@/lib/parse/chapters";

describe("countWords", () => {
  it("counts latin words by whitespace", () => {
    expect(countWords("The quick brown fox jumps over the lazy dog")).toBe(9);
  });

  it("counts every CJK character as one word", () => {
    expect(countWords("他走在大街上")).toBe(6);
  });

  it("counts mixed CJK + latin text", () => {
    expect(countWords("第一章 序 幕 hello world")).toBe(7);
  });

  it("returns 0 for empty text", () => {
    expect(countWords("   ")).toBe(0);
  });
});

describe("detectHeading", () => {
  it("detects English chapter markers", () => {
    expect(detectHeading("Chapter 1")).toBe("Chapter 1");
    expect(detectHeading("CHAPTER TWELVE")).toBe("CHAPTER TWELVE");
    expect(detectHeading("Ch. 42")).toBe("Ch. 42");
    expect(detectHeading("Chapter 7: The Storm")).toBe("Chapter 7: The Storm");
    expect(detectHeading("Chapter X")).toBe("Chapter X");
  });

  it("detects Indonesian markers", () => {
    expect(detectHeading("Bab 1")).toBe("Bab 1");
    expect(detectHeading("Bab 12: Kelahiran Kembali")).toBe("Bab 12: Kelahiran Kembali");
    expect(detectHeading("Bagian 3")).toBe("Bagian 3");
  });

  it("detects CJK markers", () => {
    expect(detectHeading("第1章 万古神帝")).toBe("第1章 万古神帝");
    expect(detectHeading("第一章 启程")).toBe("第一章 启程");
    expect(detectHeading("卷 一 风云起")).toBe("卷 一 风云起");
  });

  it("detects volume / prologue markers", () => {
    expect(detectHeading("Prologue")).toBe("Prologue");
    expect(detectHeading("Epilogue")).toBe("Epilogue");
    expect(detectHeading("Book 1")).toBe("Book 1");
  });

  it("rejects ordinary paragraphs", () => {
    expect(detectHeading("The chapter was long awaited by all.")).toBeNull();
    expect(detectHeading("Chaptering is a strange hobby.")).toBeNull();
    expect(detectHeading("")).toBeNull();
    expect(detectHeading("   ")).toBeNull();
  });
});

describe("parseChapters — heading-based splitting", () => {
  it("splits chapters on headings and keeps titles", () => {
    const text = [
      "Chapter 1",
      "It was a dark and stormy night.",
      "The wind howled.",
      "",
      "Chapter 2",
      "Morning came swiftly.",
    ].join("\n");

    const chapters = parseChapters(text);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Chapter 1");
    expect(chapters[1].title).toBe("Chapter 2");
    expect(chapters[0].content).toContain("dark and stormy night");
    expect(chapters[0].content).toContain("wind howled");
    expect(chapters[1].content).toContain("Morning came swiftly");
  });

  it("escapes HTML special characters in content", () => {
    const chapters = parseChapters("Chapter 1\nHe said <b>no</b> & walked away.");
    expect(chapters[0].content).toContain("&lt;b&gt;");
    expect(chapters[0].content).not.toContain("<b>no</b>");
  });

  it("treats content before the first heading as a prologue", () => {
    const text = [
      "Some introductory text.",
      "More intro.",
      "",
      "Chapter 1",
      "The real story begins.",
    ].join("\n");
    const chapters = parseChapters(text, { wordsPerChapter: 3000 });
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Prologue");
    expect(chapters[1].title).toBe("Chapter 1");
  });

  it("splits Chinese novels on 第N章", () => {
    const text = [
      "第一章 初入江湖",
      "少年提剑而行。",
      "风起云涌。",
      "第二章 拜师",
      "他叩首三拜。",
    ].join("\n");
    const chapters = parseChapters(text);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("第一章 初入江湖");
    expect(chapters[1].title).toBe("第二章 拜师");
    expect(chapters[0].content).toContain("少年提剑而行");
  });
});

describe("parseChapters — fallback chunking", () => {
  it("chunks text without headings by word count", () => {
    const para = "The rain fell endlessly over the silent city. ";
    const text = "Preamble without headings. " + para.repeat(200); // ~1700 words
    const chapters = parseChapters(text, { wordsPerChapter: 500 });
    expect(chapters.length).toBeGreaterThanOrEqual(3);
    expect(chapters[0].title).toBe("Chapter 1");
    expect(chapters[1].title).toBe("Chapter 2");
  });

  it("respects wordsPerChapter limits cumulatively", () => {
    const text = Array.from({ length: 20 }, () => "word ".repeat(40).trim()).join("\n");
    const chapters = parseChapters(text, { wordsPerChapter: 400 });
    expect(chapters.length).toBe(2);
    expect(chapters[0].words).toBeLessThanOrEqual(800);
  });

  it("handles hard-wrapped paragraphs when blank lines dominate", () => {
    const text = [
      "This is the first paragraph that wraps",
      "onto the next physical line.",
      "",
      "And here is the second paragraph that",
      "also wraps across two lines.",
      "",
      "A third paragraph, still wrapping",
      "across lines.",
    ].join("\n");
    const chapters = parseChapters(text);
    expect(chapters[0].content).toContain(
      "<p>This is the first paragraph that wraps onto the next physical line.</p>"
    );
    expect(chapters[0].content).toContain(
      "<p>And here is the second paragraph that also wraps across two lines.</p>"
    );
  });

  it("keeps one paragraph per line when blank lines are only occasional", () => {
    // The reported bug: a webnovel dump (one paragraph per line) with a
    // stray blank line must NOT merge into a single giant paragraph.
    const text = [
      "第一卷 序章",
      "这是第一个段落。",
      "这是第二个段落。",
      "这是第三个段落。",
      "",
      "第二章 开始",
      "新的段落出现了。",
    ].join("\n");
    const chapters = parseChapters(text);
    expect(chapters).toHaveLength(2);
    // 3 paragraphs in the first chapter, each rendered as its own <p>.
    expect((chapters[0].content.match(/<p>/g) ?? []).length).toBe(3);
    expect(chapters[0].content).toContain("<p>这是第一个段落。</p>");
    expect(chapters[0].content).toContain("<p>这是第二个段落。</p>");
    // Paragraphs must NOT be glued together into one long piece of text.
    expect(chapters[0].content).not.toContain("这是第一个段落。这是第二个段落。");
  });

  it("returns [] for empty input", () => {
    expect(parseChapters("")).toEqual([]);
    expect(parseChapters("\n\n\n")).toEqual([]);
  });
});
