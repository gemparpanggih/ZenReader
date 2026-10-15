import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { vinextBundleFix } from "./scripts/fix-vinext-bundle.mjs";

/**
 * vinext (beta) writes its "deploy-filled" externals to the bundle root but
 * the worker entries import them relative to `_next/static/`. This hook
 * (registered after the Cloudflare plugin) copies them next to the entries
 * after every build — CLI `vite build` AND the deploy pipeline's internal
 * build. See scripts/fix-vinext-bundle.mjs.
 */
const vinextBundleFixPlugin = {
  name: "zenreader:fix-vinext-bundle",
  closeBundle() {
    vinextBundleFix();
  },
} satisfies Plugin;

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
    vinextBundleFixPlugin,
  ],
});
