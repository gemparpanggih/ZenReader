/** HTML sanitization for EPUB-derived content (client-side only). */
import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "svg",
      "math",
      "video",
      "audio",
      "canvas",
      "img",
      "picture",
      "source",
      "track",
    ],
    FORBID_ATTR: ["src", "href", "style", "class", "id", "onload", "onerror"],
  });
}
