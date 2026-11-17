// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

function inlineGzipAssets(): Plugin {
  return {
    name: "f1-insightx-inline-gzip-assets",
    enforce: "pre",
    load(id) {
      if (!id.endsWith(".json.gz?inline")) return null;
      const file = id.slice(0, -"?inline".length);
      const base64 = readFileSync(file).toString("base64");
      return `export default "data:application/gzip;base64,${base64}";`;
    },
  };
}

export default defineConfig({
  plugins: [inlineGzipAssets()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  },
});
