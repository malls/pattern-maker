import { defineConfig } from "vite";

export default defineConfig({
  // Relative base serves three masters at once: the GitHub Pages subpath
  // (/pattern-maker/), local preview, and the Tauri wrap — the bundle has no
  // dynamic imports or workers, so the relative-base caveats don't apply.
  base: "./",
});
