import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@ai-txt/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
