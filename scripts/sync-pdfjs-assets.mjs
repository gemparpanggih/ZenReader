/**
 * Copies pdf.js runtime assets (CMaps + standard fonts) into public/ so
 * the worker can fetch them at runtime. Required for CJK PDF support.
 * Runs automatically via `postinstall`.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "pdfjs-dist");
const outDir = join(root, "public", "pdfjs");

for (const dir of ["cmaps", "standard_fonts"]) {
  const src = join(pkgDir, dir);
  if (!existsSync(src)) {
    console.warn(`sync-pdfjs-assets: ${src} not found, skipping`);
    continue;
  }
  mkdirSync(join(outDir, dir), { recursive: true });
  cpSync(src, join(outDir, dir), { recursive: true, force: true });
  console.log(`sync-pdfjs-assets: copied ${dir} → public/pdfjs/${dir}`);
}
