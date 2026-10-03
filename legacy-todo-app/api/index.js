/**
 * Vercel serverless entry point.
 *
 * Vercel never runs `node src/index.js`. It imports this module and calls the
 * default export as a request handler — and an Express app is exactly such a
 * function, so the same `createApp` factory serves the dashboard on localhost
 * and in production with no duplicated wiring.
 *
 * Static files are disabled here (`publicDir: null`): Vercel serves the built
 * `web/dist` itself, and this function only answers `/api/*`.
 */

import { createApp } from "../src/app.js";
import { TodoStore } from "../src/store.js";

/**
 * The only writable directory on Vercel is `/tmp`, and it is wiped whenever the
 * instance is recycled — so tasks do NOT survive there. Set `TODO_DB_PATH` to
 * real storage (hosted SQLite, say) to make them persist.
 */
export const DB_PATH = process.env.TODO_DB_PATH ?? "/tmp/data/todos.db";

// Vercel reuses a warm module across requests, so the store opens once per
// instance rather than per request.
const store = new TodoStore(DB_PATH);
const app = createApp(store, { publicDir: null, logRequests: false });

export default app;
