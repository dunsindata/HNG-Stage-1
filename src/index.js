#!/usr/bin/env node
/**
 * Entry point: read CLI flags, open the SQLite database and serve the app.
 *
 *   node src/index.js                    -> http://127.0.0.1:8000
 *   node src/index.js --port 9000
 *   node src/index.js --db ./data/mine.db
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { createApp } from "./app.js";
import { TodoStore } from "./store.js";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Prefer the built React UI in web/dist; fall back to the no-build front-end in
 * public/ so the app still works before anyone runs a build.
 */
function resolvePublicDir() {
  const built = join(PROJECT_ROOT, "web", "dist");
  return existsSync(join(built, "index.html")) ? built : join(PROJECT_ROOT, "public");
}

const USAGE = `A to-do list web app.

Usage: node src/index.js [options]

Options:
  --host <address>   Interface to bind (default: 127.0.0.1)
  --port <number>    Port to bind (default: 8000)
  --db <path>        SQLite file to persist to-dos in (default: data/todos.db)
  -h, --help         Show this message

API:
  GET    /api/health                   service probe
  GET    /api/stats                    counts per state, for the donut charts
  GET    /api/todos?filter=&q=         list to-dos (filter = all|open|not_started|in_progress|completed)
  POST   /api/todos                    create a to-do
  GET    /api/todos/:id                fetch one to-do
  PATCH  /api/todos/:id                update title/description/status/priority/due_date/image
  DELETE /api/todos/:id                delete one to-do
  POST   /api/todos/clear-completed    delete every completed to-do`;

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      host: { type: "string", default: "127.0.0.1" },
      port: { type: "string", default: "8000" },
      db: { type: "string", default: join(PROJECT_ROOT, "data", "todos.db") },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`--port must be a whole number between 0 and 65535 (got "${values.port}")`);
  }
  return { ...values, port };
}

function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseCli(argv);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(`\n${USAGE}`);
    return 1;
  }

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const store = new TodoStore(options.db);
  const publicDir = resolvePublicDir();
  const server = createApp(store, { publicDir }).listen(options.port, options.host, () => {
    const address = server.address();
    if (address && typeof address === "object") {
      console.log(`To-do list running at http://${options.host}:${address.port}/  (press Ctrl+C to stop)`);
    }
    console.log(`Storing data in ${resolve(options.db)}`);
    console.log(`Serving the UI from ${publicDir}`);
  });

  server.on("error", (error) => {
    console.error(`Could not start the server: ${error.message}`);
    store.close();
    process.exit(1);
  });

  const shutdown = () => {
    console.log("\nShutting down.");
    server.close(() => {
      store.close();
      process.exit(0);
    });
    server.closeAllConnections();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return 0;
}

process.exitCode = main();
