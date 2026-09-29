/**
 * SQLite persistence for the to-do list.
 *
 * Uses the built-in `node:sqlite` module (Node >= 22.5), so the storage layer
 * needs no native build step and no third-party driver. All three of the
 * module's calls are synchronous, which - combined with Node running our
 * handlers on a single thread - means writes cannot interleave and need no
 * explicit locking.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const PRIORITIES = ["low", "medium", "high"];
export const DEFAULT_PRIORITY = "medium";
export const STATUS_FILTERS = ["all", "active", "completed"];
export const UPDATABLE_FIELDS = ["title", "completed", "priority", "due_date"];
export const MAX_TITLE_LENGTH = 200;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS todos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    completed    INTEGER NOT NULL DEFAULT 0,
    priority     TEXT    NOT NULL DEFAULT 'medium',
    due_date     TEXT,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos (completed);
`;

export class TodoError extends Error {}

export class ValidationError extends TodoError {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends TodoError {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Current UTC time as ISO-8601 with a trailing `Z`, truncated to seconds. */
export function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ------------------------------------------------------------------ validation

export function cleanTitle(raw) {
  if (typeof raw !== "string") throw new ValidationError("title must be a string");
  const title = raw.replace(/\s+/g, " ").trim();
  if (!title) throw new ValidationError("title must not be empty");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return title;
}

export function cleanPriority(raw) {
  if (typeof raw !== "string") throw new ValidationError("priority must be a string");
  const priority = raw.trim().toLowerCase();
  if (!PRIORITIES.includes(priority)) {
    throw new ValidationError(`priority must be one of: ${PRIORITIES.join(", ")}`);
  }
  return priority;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function cleanDueDate(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") {
    throw new ValidationError("due_date must be a 'YYYY-MM-DD' string or null");
  }
  const text = raw.trim();
  if (!text) return null;
  if (!DATE_PATTERN.test(text)) {
    throw new ValidationError("due_date must be a valid 'YYYY-MM-DD' date");
  }
  // Rejects impossible dates such as 2030-02-30, which Date would roll over.
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new ValidationError("due_date must be a valid 'YYYY-MM-DD' date");
  }
  return text;
}

export function cleanCompleted(raw) {
  if (typeof raw !== "boolean") {
    throw new ValidationError("completed must be true or false");
  }
  return raw;
}

export function cleanTodoId(raw) {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    throw new ValidationError("id must be a positive integer");
  }
  return raw;
}

/** Escape LIKE wildcards so a search term matches literally. */
function escapeLike(term) {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function rowToTodo(row) {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed === 1,
    priority: row.priority,
    due_date: row.due_date ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at ?? null,
  };
}

// ---------------------------------------------------------------------- store

export class TodoStore {
  #db;

  constructor(dbPath = "todos.db") {
    this.dbPath = dbPath;
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(resolve(dbPath)), { recursive: true });
    }
    this.#db = new DatabaseSync(dbPath);
    this.#db.exec("PRAGMA journal_mode = WAL");
    this.#db.exec(SCHEMA);
  }

  close() {
    this.#db.close();
  }

  // ------------------------------------------------------------------ queries

  /** To-dos newest first, with anything still open listed first. */
  listTodos({ status = "all", query = "" } = {}) {
    if (!STATUS_FILTERS.includes(status)) {
      throw new ValidationError(`status must be one of: ${STATUS_FILTERS.join(", ")}`);
    }
    if (typeof query !== "string") throw new ValidationError("query must be a string");

    const clauses = [];
    const params = [];
    if (status === "active") clauses.push("completed = 0");
    else if (status === "completed") clauses.push("completed = 1");

    const term = query.trim();
    if (term) {
      clauses.push("title LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(term)}%`);
    }

    let sql = "SELECT * FROM todos";
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY completed ASC, created_at DESC, id DESC";

    return this.#db
      .prepare(sql)
      .all(...params)
      .map(rowToTodo);
  }

  getTodo(todoId) {
    return rowToTodo(this.#fetch(cleanTodoId(todoId)));
  }

  /** Number of total, active and completed to-dos. */
  stats() {
    const row = this.#db
      .prepare(
        "SELECT COUNT(*) AS total," +
          " COALESCE(SUM(completed), 0) AS completed," +
          " COALESCE(SUM(1 - completed), 0) AS active" +
          " FROM todos",
      )
      .get();
    return { total: row.total, active: row.active, completed: row.completed };
  }

  // ----------------------------------------------------------------- mutation

  createTodo(title, { priority = DEFAULT_PRIORITY, due_date: dueDate = null } = {}) {
    const clean = cleanTitle(title);
    const cleanPriorityValue = cleanPriority(priority);
    const cleanDueDateValue = cleanDueDate(dueDate);
    const now = utcNow();

    const info = this.#db
      .prepare(
        "INSERT INTO todos (title, completed, priority, due_date, created_at, updated_at)" +
          " VALUES (?, 0, ?, ?, ?, ?)",
      )
      .run(clean, cleanPriorityValue, cleanDueDateValue, now, now);

    return this.getTodo(Number(info.lastInsertRowid));
  }

  /** Apply a partial update and return the stored result. */
  updateTodo(todoId, changes) {
    const id = cleanTodoId(todoId);
    if (changes === null || typeof changes !== "object" || Array.isArray(changes)) {
      throw new ValidationError("changes must be an object");
    }

    const unknown = Object.keys(changes)
      .filter((field) => !UPDATABLE_FIELDS.includes(field))
      .sort();
    if (unknown.length > 0) {
      throw new ValidationError(`unknown field(s): ${unknown.join(", ")}`);
    }

    const assignments = {};
    for (const [field, raw] of Object.entries(changes)) {
      if (field === "title") assignments.title = cleanTitle(raw);
      else if (field === "completed") assignments.completed = cleanCompleted(raw) ? 1 : 0;
      else if (field === "priority") assignments.priority = cleanPriority(raw);
      else assignments.due_date = cleanDueDate(raw);
    }

    this.#fetch(id); // surfaces a 404 for unknown ids
    if (Object.keys(assignments).length === 0) return this.getTodo(id);

    const now = utcNow();
    if ("completed" in assignments) {
      assignments.completed_at = assignments.completed === 1 ? now : null;
    }
    assignments.updated_at = now;

    // Column names come from UPDATABLE_FIELDS, never from user input.
    const columns = Object.keys(assignments)
      .map((name) => `${name} = ?`)
      .join(", ");
    this.#db
      .prepare(`UPDATE todos SET ${columns} WHERE id = ?`)
      .run(...Object.values(assignments), id);

    return this.getTodo(id);
  }

  deleteTodo(todoId) {
    const id = cleanTodoId(todoId);
    const info = this.#db.prepare("DELETE FROM todos WHERE id = ?").run(id);
    if (info.changes === 0) throw new NotFoundError(`to-do ${id} was not found`);
    return id;
  }

  /** Delete every completed to-do and return how many were removed. */
  clearCompleted() {
    const info = this.#db.prepare("DELETE FROM todos WHERE completed = 1").run();
    return Math.max(info.changes, 0);
  }

  // ------------------------------------------------------------------- private

  #fetch(todoId) {
    const row = this.#db.prepare("SELECT * FROM todos WHERE id = ?").get(todoId);
    if (row === undefined) throw new NotFoundError(`to-do ${todoId} was not found`);
    return row;
  }
}
