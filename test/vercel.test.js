/**
 * Tests for the deployment wiring: the Vercel config and the serverless entry
 * point in api/index.js. A deployment should never be the first place you find
 * out the function is broken.
 *
 * Run with: npm test   (or: node --test test/vercel.test.js)
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const projectRoot = join(import.meta.dirname, "..");

describe("vercel.json", () => {
  const config = JSON.parse(readFileSync(join(projectRoot, "vercel.json"), "utf8"));

  it("builds the React dashboard and serves it as static output", () => {
    assert.equal(config.outputDirectory, "web/dist");
    assert.match(config.buildCommand, /web:build/);
  });

  it("sends every /api path to the serverless function", () => {
    // Filesystem routes win over rewrites, so /api/todos falls through to this.
    assert.deepEqual(config.rewrites, [{ source: "/api/(.*)", destination: "/api/index" }]);
  });
});

describe("the Vercel serverless function", () => {
  it("handles requests and keeps the database off the read-only filesystem", async () => {
    // Set the path before importing: the module opens its store at load time.
    // This also keeps the test off "C:\tmp" on Windows.
    const dir = mkdtempSync(join(tmpdir(), "todo-vercel-"));
    process.env.TODO_DB_PATH = join(dir, "todos.db");

    const { default: handler, DB_PATH } = await import("../api/index.js");

    assert.equal(typeof handler, "function", "the default export must be callable");
    assert.equal(DB_PATH, process.env.TODO_DB_PATH);

    // An Express app is a (req, res) listener, so it can be driven directly.
    const server = handler.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    try {
      const health = await fetch(`${base}/api/health`);
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: "ok" });

      const created = await fetch(`${base}/api/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Deployed task", status: "in_progress" }),
      });
      assert.equal(created.status, 201);
      assert.equal((await created.json()).todo.status, "in_progress");

      const stats = await fetch(`${base}/api/stats`);
      assert.deepEqual(await stats.json(), {
        total: 1,
        completed: 0,
        in_progress: 1,
        not_started: 0,
        open: 1,
      });

      // Static serving is off here: Vercel serves the built UI, not Express.
      const root = await fetch(`${base}/`);
      assert.equal(root.status, 404);
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
  });
});
