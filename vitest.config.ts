import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // The DB-backed tests (migration smoke + final-state authority) share one
    // live Supabase/Postgres instance. Disable file-level parallelism so they
    // never apply migrations against the same database concurrently (Round13).
    fileParallelism: false,
  },
});
