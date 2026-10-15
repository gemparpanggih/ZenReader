/**
 * vinext (beta) emits "deploy-filled" externals (cacheability manifest,
 * client-assets, etc.) at the bundle root, while the worker entries in
 * `bundle/_next/static/` import them with relative `./` specifiers that
 * resolve inside that directory. The Cloudflare worker runtime fails with
 * "No such module" (validation error 10021) for these.
 *
 * This module copies those root-level modules into `bundle/_next/static/`
 * so every relative import in the emitted entries resolves. It is wired in
 * two places so BOTH `npm run build:vinext` and `npm run deploy:vinext`
 * (which builds through the Vite API) get the fix:
 *   - directly, when run from the CLI (`node scripts/fix-vinext-bundle.mjs`)
 *   - as a Vite plugin hook from `vite.config.ts` (see `vinextBundleFix`)
 *
 * It's a no-op when nothing is missing, so it's safe if a vinext upgrade
 * ever fixes the layout.
 */
import { existsSync, copyFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function defaultBundleDir() {
  return join(
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    ".cloudflare", "output", "v0", "workers", "default", "bundle"
  );
}

/** All relative `./x.js` / `../x.js` imports inside a file's source. */
function relativeImports(file) {
  const src = readFileSync(file, "utf8");
  const found = new Set();
  for (const m of src.matchAll(/from\s*["'](\.[^"']+\.js)["']/g)) found.add(m[1]);
  for (const m of src.matchAll(/import\(?\s*["'](\.[^"']+\.js)["']/g)) found.add(m[1]);
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

/** Run the fix; returns the number of modules copied. Safe to call repeatedly. */
export function vinextBundleFix(bundleDir = defaultBundleDir()) {
  const staticDir = join(bundleDir, "_next", "static");
  if (!existsSync(staticDir)) return 0;

  let copied = 0;
  for (const file of jsFiles(staticDir)) {
    for (const spec of relativeImports(file)) {
      const target = resolve(dirname(file), spec);
      if (existsSync(target)) continue; // already resolves
      // Source it from the bundle root (vinext's emission location).
      const fromRoot = join(bundleDir, spec.split("/").pop());
      if (existsSync(fromRoot) && !existsSync(target)) {
        copyFileSync(fromRoot, target);
        copied++;
        console.log(`fix-vinext-bundle: copied ${relative(bundleDir, fromRoot)} → ${relative(bundleDir, target)}`);
      }
    }
  }
  return copied;
}

/* CLI entrypoint: `node scripts/fix-vinext-bundle.mjs` */
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const copied = vinextBundleFix();
  console.log(
    copied === 0
      ? "fix-vinext-bundle: no missing modules found (layout OK)"
      : `fix-vinext-bundle: fixed ${copied} missing module(s)`
  );
}
