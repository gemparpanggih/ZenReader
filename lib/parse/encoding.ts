/* ============================================================
   Text decoding with encoding fallbacks.
   Many downloaded Chinese novels (.txt) are GBK / Big5 encoded,
   not UTF-8. Browsers support 'gbk' and 'big5' via TextDecoder.
   ============================================================ */

/** Rough score of how "Chinese" a decoded string looks.
 *  Rewards CJK characters, heavily penalizes replacement chars. */
function scoreChinese(text: string): number {
  let cjk = 0;
  let replacement = 0;
  for (const ch of text) {
    if (ch === "\uFFFD") replacement++;
    else if (/[\u3400-\u9FFF]/.test(ch)) cjk++;
  }
  return cjk - replacement * 3;
}

function tryDecode(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return "";
  }
}

/**
 * Decode bytes to text, handling the common Chinese encodings:
 * 1. UTF-8/16 BOM sniffing
 * 2. strict UTF-8
 * 3. GBK vs Big5 (whichever yields more plausible Chinese text)
 * 4. lossy UTF-8 as a last resort
 */
export function decodeTextWithFallback(bytes: Uint8Array): string {
  /* UTF BOMs first */
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }

  /* Strict UTF-8: most files (and all modern webnovel downloads) */
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    /* not valid UTF-8 → try Chinese legacy encodings */
  }

  const gbk = tryDecode(bytes, "gbk");
  const big5 = tryDecode(bytes, "big5");
  if (gbk && big5) {
    return scoreChinese(gbk) >= scoreChinese(big5) ? gbk : big5;
  }
  if (gbk) return gbk;
  if (big5) return big5;
  return new TextDecoder("utf-8").decode(bytes); // last resort, lossy
}

/** Decode an ArrayBuffer using the same fallback chain. */
export function decodeArrayBuffer(buffer: ArrayBuffer): string {
  return decodeTextWithFallback(new Uint8Array(buffer));
}
