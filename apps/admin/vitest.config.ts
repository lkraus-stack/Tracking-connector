import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"]
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "@tracking-connector/airbyte": new URL("../../packages/airbyte/src/index.ts", import.meta.url).pathname,
      "@tracking-connector/bigquery": new URL("../../packages/bigquery/src/index.ts", import.meta.url).pathname,
      "@tracking-connector/shared": new URL("../../packages/shared/src/index.ts", import.meta.url).pathname
    }
  }
});
