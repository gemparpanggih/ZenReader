import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseEpub, xhtmlToChapterHtml } from "@/lib/parse/epub";

/** Build a minimal valid EPUB (no compression) in memory. */
async function buildEpub(opts: {
  title?: string;
  creator?: string;
  description?: string;
  chapters: { id: string; bodyHTML: string; mediaType?: string }[];
}): Promise<Blob> {
  const { title, creator = "Jane Doe", description = "A test.", chapters } = opts;
  const zip = new JSZip();

  zip.file(
    "mimetype",
    "application/epub+zip" // stored uncompressed in real epubs, fine either way here
  );

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:test-0001</dc:identifier>
    ${title ? `<dc:title>${title}</dc:title>` : ""}
    ${creator ? `<dc:creator>${creator}</dc:creator>` : ""}
    ${description ? `<dc:description>${description}</dc:description>` : ""}
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${chapters
      .map(
        (c, i) =>
          `<item id="ch${i}" href="ch${i}.xhtml" media-type="${c.mediaType ?? "application/xhtml+xml"}"/>`
      )
      .join("\n    ")}
  </manifest>
  <spine>
    ${chapters.map((c, i) => `<itemref idref="ch${i}"/>`).join("\n    ")}
  </spine>
</package>`
  );

  chapters.forEach((c, i) => {
    zip.file(
      `OEBPS/ch${i}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${c.id}</title></head>
<body>${c.bodyHTML}</body>
</html>`
    );
  });

  return zip.generateAsync({ type: "blob" });
}

describe("xhtmlToChapterHtml", () => {
  it("extracts title from the first heading", () => {
    const { title, html } = xhtmlToChapterHtml(
      "<html><head><title>ignored</title></head><body><h1>The Beginning</h1><p>Once upon a time…</p></body></html>"
    );
    expect(title).toBe("The Beginning");
    expect(html).toContain("Once upon a time");
  });

  it("strips scripts, styles, links and images", () => {
    const { html } = xhtmlToChapterHtml(
      `<html><body>
        <script>alert("xss")</script>
        <style>p{color:red}</style>
        <a href="javascript:alert(1)">click me</a>
        <img src="evil.png"/>
        <p>Keep me</p>
      </body></html>`
    );
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("href");
    expect(html).not.toContain("<img");
    expect(html).toContain("Keep me");
    expect(html).toContain("click me"); // link text preserved
  });

  it("flattens divs into paragraphs", () => {
    const { html } = xhtmlToChapterHtml(
      "<html><body><div><p>One</p><div><p>Two</p></div></div></body></html>"
    );
    expect(html).toContain("<p>One</p>");
    expect(html).toContain("<p>Two</p>");
  });
});

describe("parseEpub", () => {
  it("parses metadata, cover-less single chapter and spine order", async () => {
    const blob = await buildEpub({
      title: "The Hidden City",
      creator: "Ada Lovelace",
      description: "A novel about cities.",
      chapters: [
        { id: "ch1", bodyHTML: "<h1>Arrival</h1><p>She arrived at dawn.</p>" },
        { id: "ch2", bodyHTML: "<h2>Departure</h2><p>Then she left.</p>" },
      ],
    });

    const book = await parseEpub(blob, "fallback");
    expect(book.title).toBe("The Hidden City");
    expect(book.author).toBe("Ada Lovelace");
    expect(book.description).toContain("cities");
    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0].title).toBe("Arrival");
    expect(book.chapters[1].title).toBe("Departure");
    expect(book.chapters[0].content).toContain("She arrived at dawn.");
    expect(book.chapters[0].words).toBeGreaterThan(0);
  });

  it("fallback-titles chapters without headings", async () => {
    const blob = await buildEpub({
      chapters: [{ id: "x", bodyHTML: "<p>Just text, no heading.</p>" }],
    });
    const book = await parseEpub(blob, "My Fallback");
    expect(book.title).toBe("My Fallback");
    expect(book.chapters[0].title).toBe("Chapter 1");
  });

  it("skips empty spine items", async () => {
    const blob = await buildEpub({
      chapters: [
        { id: "empty", bodyHTML: "<p>   </p>" },
        { id: "real", bodyHTML: "<p>Real content here.</p>" },
      ],
    });
    const book = await parseEpub(blob, "fallback");
    expect(book.chapters).toHaveLength(1);
    expect(book.chapters[0].content).toContain("Real content");
  });

  it("throws on non-epub input", async () => {
    const junk = new Blob(["this is not a zip"], { type: "application/epub+zip" });
    await expect(parseEpub(junk, "x")).rejects.toThrow();
  });
});
