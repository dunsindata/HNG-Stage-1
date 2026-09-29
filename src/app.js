/**
 * Express application for the to-do list.
 *
 * `createApp` is deliberately pure: it takes a store and returns an app, so
 * tests can drive it without binding a fixed port or touching a real database.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import {
  DEFAULT_PRIORITY,
  NotFoundError,
  STATUS_FILTERS,
  ValidationError,
} from "./store.js";

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_SEARCH_LENGTH = 200;
export const ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";

const DEFAULT_PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Known `/api` paths, so a wrong method gets 405 instead of 404. */
const KNOWN_API_PATHS = [/^\/todos$/, /^\/todos\/\d+$/, /^\/todos\/clear-completed$/, /^\/health$/, /^\/stats$/];

export function createApp(store, { publicDir = DEFAULT_PUBLIC_DIR, logRequests = true } = {}) {
  const app = express();
  app.disable("x-powered-by");

  if (logRequests) {
    app.use((req, res, next) => {
      res.on("finish", () => {
        process.stderr.write(`${req.ip} - "${req.method} ${req.originalUrl}" ${res.statusCode}\n`);
      });
      next();
    });
  }

  app.use(express.json({ limit: MAX_BODY_BYTES }));

  const api = express.Router();

  // A middleware rather than a wildcard route: wildcard syntax differs between
  // Express 4 and 5, and this behaves identically on both.
  api.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      return res.status(204).set("Allow", ALLOWED_METHODS).end();
    }
    return next();
  });

  api.get("/health", (req, res) => res.json({ status: "ok" }));

  api.get("/stats", (req, res) => res.json(store.stats()));

  api.get("/todos", (req, res) => {
    const todos = store.listTodos({
      status: statusFilter(req.query.status),
      query: searchTerm(req.query.q),
    });
    res.json({ todos });
  });

  api.post("/todos/clear-completed", (req, res) => {
    res.json({ deleted: store.clearCompleted() });
  });

  api.post("/todos", (req, res) => {
    const body = requireObjectBody(req);
    const todo = store.createTodo(body.title, {
      priority: body.priority ?? DEFAULT_PRIORITY,
      due_date: body.due_date ?? null,
    });
    res.status(201).location(`/api/todos/${todo.id}`).json({ todo });
  });

  api.get("/todos/:id", (req, res) => {
    res.json({ todo: store.getTodo(parseTodoId(req.params.id)) });
  });

  api.patch("/todos/:id", (req, res) => {
    const body = requireObjectBody(req);
    res.json({ todo: store.updateTodo(parseTodoId(req.params.id), body) });
  });

  api.delete("/todos/:id", (req, res) => {
    res.json({ deleted: store.deleteTodo(parseTodoId(req.params.id)) });
  });

  app.use("/api", api);

  // Reached only when no route above matched.
  app.use("/api", (req, res) => {
    if (KNOWN_API_PATHS.some((pattern) => pattern.test(req.path))) {
      return res
        .status(405)
        .set("Allow", ALLOWED_METHODS)
        .json({ error: `method ${req.method} is not allowed here` });
    }
    return res.status(404).json({ error: `unknown endpoint: ${req.originalUrl}` });
  });

  app.use(express.static(publicDir));

  app.use((req, res) => {
    res.status(404).type("text/plain").send("Not found");
  });

  // eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
  app.use((error, req, res, next) => {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    if (error?.type === "entity.too.large") {
      return res
        .status(400)
        .json({ error: `request body must be at most ${MAX_BODY_BYTES} bytes` });
    }
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "request body must be valid UTF-8 JSON" });
    }
    process.stderr.write(`${error?.stack ?? error}\n`);
    return res.status(500).json({ error: "internal server error" });
  });

  return app;
}

// -------------------------------------------------------------------- helpers

/** `/api/todos/:id` accepts digits only; anything else is "no such endpoint". */
function parseTodoId(raw) {
  if (!/^\d+$/.test(raw)) throw new NotFoundError(`unknown endpoint: /api/todos/${raw}`);
  const id = Number(raw);
  if (id < 1) throw new NotFoundError(`unknown endpoint: /api/todos/${raw}`);
  return id;
}

/** Express leaves `req.body` undefined for requests without a JSON body. */
function requireObjectBody(req) {
  const { body } = req;
  if (body === undefined || body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("request body must be a JSON object");
  }
  return body;
}

/** Query values can arrive as an array when a parameter is repeated. */
function lastQueryValue(value) {
  if (Array.isArray(value)) return value.length > 0 ? String(value[value.length - 1]) : "";
  return value === undefined ? "" : String(value);
}

function statusFilter(value) {
  const status = lastQueryValue(value) || "all";
  if (!STATUS_FILTERS.includes(status)) {
    throw new ValidationError(`status must be one of: ${STATUS_FILTERS.join(", ")}`);
  }
  return status;
}

function searchTerm(value) {
  const term = lastQueryValue(value);
  if (term.length > MAX_SEARCH_LENGTH) {
    throw new ValidationError(`q must be at most ${MAX_SEARCH_LENGTH} characters`);
  }
  return term;
}
