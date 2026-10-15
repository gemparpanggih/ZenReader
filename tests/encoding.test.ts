import { describe, expect, it } from "vitest";
import { decodeArrayBuffer, decodeTextWithFallback } from "@/lib/parse/encoding";

/**
 * Fixture bytes generated with Python:
 *   "第一章 测试 少年提剑而行".encode("gbk")
 *   "第一章 測試 繁體中文".encode("big5")
 */
const GBK_BYTES = new Uint8Array([
  181, 218, 210, 187, 213, 194, 32, 178, 226, 202, 212, 32, 201, 217, 196, 234,
  204, 225, 189, 163, 182, 248, 208, 208,
]);
const BIG5_BYTES = new Uint8Array([
  178, 196, 164, 64, 179, 185, 32, 180, 250, 184, 213, 32, 193, 99, 197, 233,
  164, 164, 164, 229,
]);

describe("decodeTextWithFallback", () => {
  it("decodes plain UTF-8", () => {
    const text = "Chapter 1 — The adventure begins.";
    expect(decodeTextWithFallback(new TextEncoder().encode(text))).toBe(text);
  });

  it("strips a UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Hello")]);
    expect(decodeTextWithFallback(bytes)).toBe("Hello");
  });

  it("decodes UTF-16LE and UTF-16BE with BOM", () => {
    const le = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
    expect(decodeTextWithFallback(le)).toBe("AB");
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]);
    expect(decodeTextWithFallback(be)).toBe("AB");
  });

  it("falls back to GBK for legacy Chinese novels", () => {
    const text = decodeTextWithFallback(GBK_BYTES);
    expect(text).toBe("第一章 测试 少年提剑而行");
    expect(text).not.toContain("\uFFFD");
  });

  it("chooses Big5 over GBK for traditional Chinese", () => {
    const text = decodeTextWithFallback(BIG5_BYTES);
    expect(text).toBe("第一章 測試 繁體中文");
  });

  it("decodes GBK via decodeArrayBuffer", () => {
    const buf = GBK_BYTES.buffer.slice(GBK_BYTES.byteOffset, GBK_BYTES.byteOffset + GBK_BYTES.byteLength);
    expect(decodeArrayBuffer(buf)).toBe("第一章 测试 少年提剑而行");
  });

  it("handles empty input", () => {
    expect(decodeTextWithFallback(new Uint8Array(0))).toBe("");
  });
});
