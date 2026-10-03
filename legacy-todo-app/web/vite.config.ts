import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * The API is served by the Express app in ../src (default port 8000). In dev,
 * Vite runs on 5173 and proxies /api to it, so the browser sees one origin and
 * no CORS configuration is needed.
 */
const API_TARGET = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // One worker, one file at a time: jsdom is heavy to boot, and a full pool
    // is slow (and flaky) on modest machines.
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
