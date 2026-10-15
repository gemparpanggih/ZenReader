import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { ParsedBook, ParsedChapter } from "../types";
import { countWords } from "./chapters";
import { sanitizeHtml } from "./html";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
});

type XmlNode = Record<string, unknown>;

/** Normalize XML parse output to an array (single nodes come back as objects). */

/** Navigate a parsed XML node by key (arrays unwrap to their first element). */
function nodeAt(node: XmlNode | undefined, key: string): XmlNode | undefined {
  const v = node?.[key];
  if (v === undefined || v === null) return undefined;
  return (Array.isArray(v) ? v[0] : v) as XmlNode;
}

function nodeList(node: XmlNode | undefined, key: string): XmlNode[] {
  const v = node?.[key];
  if (v === undefined || v === null) return [];
  return (Array.isArray(v) ? v : [v]) as XmlNode[];
}

function pickText(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (v && typeof v === "object") {
    // dc:title may contain markup; grab text payload
    const o = v as XmlNode;
    const keys = Object.keys(o);
    if (keys.length === 0) return undefined;
    return String(o["#text"] ?? keys.map((k) => o[k]).join(" ")).trim() || undefined;
  }
  return undefined;
}

/** Resolve an href relative to a base directory inside the zip. */
function resolveZipPath(baseDir: string, href: string): string {
  const clean = href.split("#")[0].split("?")[0];
  const parts = [...baseDir.split("/").filter(Boolean), ...clean.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "." || p === "") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function removeNodes(doc: Document, selector: string) {
  doc.querySelectorAll(selector).forEach((el) => el.remove());
}

function unwrapLinks(doc: Document) {
  doc.querySelectorAll("a").forEach((a) => {
    const parent = a.parentNode;
    if (!parent) return;
    while (a.firstChild) parent.insertBefore(a.firstChild, a);
    a.remove();
  });
}

/** Flatten EPUB structure: divs/sections/tables become paragraphs. */
function flattenBlocks(doc: Document, body: HTMLElement) {
  let guard = 0;
  while (guard++ < 5000) {
    const el = body.querySelector("div, section, article, main, table");
    if (!el) break;
    const p = doc.createElement("p");
    if (el.tagName === "TABLE") {
      p.textContent = el.textContent ?? "";
    } else {
      p.innerHTML = el.innerHTML;
    }
    el.replaceWith(p);
  }
}

/** Convert one XHTML/HTML spine item into a standalone HTML fragment. */
export function xhtmlToChapterHtml(xhtml: string): { html: string; title?: string } {
  const doc = new DOMParser().parseFromString(xhtml, "text/html");
  const body = doc.body;

  removeNodes(
    doc,
    "head, nav, script, style, link, meta, title, svg, object, iframe, form, audio, video, embed, canvas, button, input, select, textarea, img, picture, source, track, aside, footer, header"
  );

  unwrapLinks(doc);
  flattenBlocks(doc, body);

  // Chapter title: first visible heading, falling back to <title>.
  const heading = body.querySelector("h1, h2, h3");
  const docTitle = doc.querySelector("title")?.textContent?.trim();
  const title = heading?.textContent?.trim() || docTitle || undefined;

  const html = sanitizeHtml(body.innerHTML);
  return { html, title };
}

/**
 * Parse an EPUB (zip container): metadata, cover and spine content.
 */
export async function parseEpub(file: Blob, fallbackTitle: string): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  /* --- container.xml → OPF --- */
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Not a valid EPUB: missing META-INF/container.xml");
  const container = xmlParser.parse(await containerFile.async("string")) as XmlNode;
  const rootfileNode = nodeAt(nodeAt(nodeAt(container, "container"), "rootfiles"), "rootfile");
  const opfRel = rootfileNode?.["@_full-path"] as string | undefined;
  if (!opfRel) throw new Error("Not a valid EPUB: missing OPF rootfile");
  const opfPath = opfRel.replace(/\\/g, "/");
  const opfBase = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error(`Not a valid EPUB: missing ${opfPath}`);
  const opf = xmlParser.parse(await opfFile.async("string")) as XmlNode;
  const pkg = opf.package as XmlNode | undefined;
  if (!pkg) throw new Error("Not a valid EPUB: missing <package>");

  /* --- metadata --- */
  const meta = nodeAt(pkg, "metadata");
  const title = pickText(meta?.["dc:title"]) || fallbackTitle;
  const author = pickText(meta?.["dc:creator"]);
  const descriptionRaw = pickText(meta?.["dc:description"]) ?? "";
  const description = sanitizeHtml(descriptionRaw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  /* --- manifest + spine --- */
  const items = nodeList(nodeAt(pkg, "manifest"), "item");
  const itemById = new Map<string, { href: string; mediaType?: string; properties?: string }>();
  const hrefToAbsolute = new Map<string, string>();

  for (const item of items) {
    const href = item["@_href"] as string | undefined;
    if (!href) continue;
    const abs = resolveZipPath(opfBase, href);
    itemById.set(item["@_id"] as string, {
      href: abs,
      mediaType: item["@_media-type"] as string | undefined,
      properties: item["@_properties"] as string | undefined,
    });
    hrefToAbsolute.set(href, abs);
  }

  /* --- cover --- */
  let cover: Blob | null = null;
  const coverCandidates: string[] = [];
  for (const item of items) {
    const props = String(item["@_properties"] ?? "");
    if (props.includes("cover-image")) {
      coverCandidates.push(resolveZipPath(opfBase, item["@_href"] as string));
    }
  }
  if (coverCandidates.length === 0) {
    const metas = nodeList(meta, "meta");
    const coverMeta = metas.find((m) => String(m["@_name"] ?? "").toLowerCase() === "cover");
    if (coverMeta) {
      const coverId = coverMeta["@_content"] as string;
      const item = itemById.get(coverId);
      if (item) coverCandidates.push(item.href);
    }
  }
  for (const path of coverCandidates) {
    const coverFile = zip.file(path);
    if (coverFile) {
      try {
        const blob = await coverFile.async("blob");
        if (blob.size > 64 && blob.type.startsWith("image/")) {
          cover = blob;
          break;
        }
      } catch {
        /* keep scanning */
      }
    }
  }

  /* --- spine content --- */
  const spine = nodeList(nodeAt(pkg, "spine"), "itemref");
  const chapters: ParsedChapter[] = [];

  for (const ref of spine) {
    const idref = ref["@_idref"] as string;
    const entry = itemById.get(idref);
    if (!entry) continue;
    const isHtml =
      !entry.mediaType || /(xhtml|html)/i.test(entry.mediaType ?? "") || /\.x?html?$/i.test(entry.href);
    if (!isHtml) continue;

    const file = zip.file(entry.href);
    if (!file) continue;

    let raw: string;
    try {
      raw = await file.async("string");
    } catch {
      continue;
    }

    const { html, title: chapterTitle } = xhtmlToChapterHtml(raw);
    const text = html.replace(/<[^>]+>/g, " ");
    if (!text.trim()) continue; // skip empty spine items

    chapters.push({
      title: chapterTitle || `Chapter ${chapters.length + 1}`,
      content: html,
      words: countWords(text),
    });
  }

  if (chapters.length === 0) {
    throw new Error("No readable content found in this EPUB");
  }

  return { title, author, description, cover, chapters };
}

/** Strip embedded chapter titles that merely repeat the book title. */
export function dedupeChapterTitles(chapters: ParsedChapter[], bookTitle: string): ParsedChapter[] {
  return chapters.map((c, i) => {
    const t = c.title?.trim() ?? "";
    if (t.length > 0 && t === bookTitle.trim()) {
      return { ...c, title: `Chapter ${i + 1}` };
    }
    return c;
  });
}
