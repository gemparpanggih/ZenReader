/**
 * vinext (beta) emits "deploy-filled" externals (cacheability manifest,
 * client-assets, etc.) at the bundle root, while the worker entries in
 * `bundle/_next/static/` import them with relative `./` specifiers that
 * resolve inside that directory. The local preview (miniflare / the
 * platform worker runtime) fails with "No such module" for these.
 *
 * This script copies those root-level modules into `bundle/_next/static/`
 * so every relative import in the emitted entries resolves. It's a no-op
 * when nothing is missing, so it's safe on any vinext version that later
 * fixes the layout.
 */
import { existsSync, copyFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = join(root, ".cloudflare", "output", "v0", "workers", "default", "bundle");
const staticDir = join(bundleDir, "_next", "static");

if (!existsSync(staticDir)) {
  console.log("fix-vinext-bundle: no bundle/_next/static dir, nothing to do");
  process.exit(0);
}

/** All relative `./x.js` / `../x.js` imports inside a file's source. */
function relativeImports(file) {
  const src = readFileSync(file, "utf8");
  const found = new Set();
  for (const m of src.matchAll(/from\s*["'](\.[^"']+\.js)["']/g)) found.add(m[1]);
  for (const m of src.matchAll(/import\s*\(?\s*["'](\.[^"']+\.js)["']/g)) found.add(m[1]);
  return [...found];
}

/** Walk a directory for .js files. */
function jsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) jsFiles(full, out);
    else if (entry.endsWith(".js") && !entry.endsWith(".map")) out.push(full);
  }
  return out;
}

let copied = 0;
for (const file of jsFiles(staticDir)) {
  for (const spec of relativeImports(file)) {
    const target = resolve(dirname(file), spec);
    if (existsSync(target)) continue; // already resolves
    // Try to source it from the bundle root (vinext's emission location).
    const fromRoot = join(bundleDir, spec.split("/").pop());
    if (existsSync(fromRoot) && !existsSync(target)) {
      copyFileSync(fromRoot, target);
      copied++;
      console.log(`fix-vinext-bundle: copied ${relative(bundleDir, fromRoot)} → ${relative(bundleDir, target)}`);
    }
  }
}

if (copied === 0) console.log("fix-vinext-bundle: no missing modules found (layout OK)");
else console.log(`fix-vinext-bundle: fixed ${copied} missing module(s)`);
