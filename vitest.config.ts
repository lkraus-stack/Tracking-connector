import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./apps/admin/vitest.setup.ts"],
    include: ["apps/admin/tests/**/*.test.{ts,tsx}", "packages/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": new URL("./apps/admin/src", import.meta.url).pathname,
      "@tracking-connector/airbyte": new URL("./packages/airbyte/src/index.ts", import.meta.url).pathname,
      "@tracking-connector/bigquery": new URL("./packages/bigquery/src/index.ts", import.meta.url).pathname,
      "@tracking-connector/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname
    }
  }
});
