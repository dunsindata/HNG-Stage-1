/**
 * SQLite persistence for the to-do list.
 *
 * Uses the built-in `node:sqlite` module (Node >= 22.5), so the storage layer
 * needs no native build step and no third-party driver. All of the module's
 * calls are synchronous, which - combined with Node running our handlers on a
 * single thread - means writes cannot interleave and need no explicit locking.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const PRIORITIES = ["low", "medium", "high"];
export const DEFAULT_PRIORITY = "medium";

/** The three states a task moves through, in board order. */
export const STATUSES = ["not_started", "in_progress", "completed"];
export const DEFAULT_STATUS = "not_started";

/** Accepted values of the `filter` query parameter. `open` means "not completed". */
export const STATUS_FILTERS = ["all", "not_started", "in_progress", "completed", "open"];

export const UPDATABLE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "due_date",
  "image",
];

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_IMAGE_LENGTH = 500;

const SCHEMA_VERSION = 2;

/**
 * The original v1 columns, kept only so old databases can be migrated in place.
 * Deliberately has no index: a migrated table no longer has a `completed`
 * column, so re-creating that index on a later open would fail.
 */
const BASE_SCHEMA = `
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
`;

const CURRENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS todos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    description  TEXT,
    status       TEXT    NOT NULL DEFAULT 'not_started',
    priority     TEXT    NOT NULL DEFAULT 'medium',
    due_date     TEXT,
    image        TEXT,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos (status);
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

export function cleanDescription(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") {
    throw new ValidationError("description must be a string or null");
  }
  const text = raw.replace(/[ \t]+/g, " ").trim();
  if (!text) return null;
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  return text;
}

export function cleanStatus(raw) {
  if (typeof raw !== "string") throw new ValidationError("status must be a string");
  const status = raw.trim().toLowerCase();
  if (!STATUSES.includes(status)) {
    throw new ValidationError(`status must be one of: ${STATUSES.join(", ")}`);
  }
  return status;
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

/**
 * Thumbnails are rendered into `<img src>`, so only http(s) and site-relative
 * paths are accepted: that rules out `javascript:` and `data:` payloads.
 */
export function cleanImage(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") {
    throw new ValidationError("image must be a URL string or null");
  }
  const text = raw.trim();
  if (!text) return null;
  if (text.length > MAX_IMAGE_LENGTH) {
    throw new ValidationError(`image must be at most ${MAX_IMAGE_LENGTH} characters`);
  }
  if (!/^https?:\/\//i.test(text) && !text.startsWith("/")) {
    throw new ValidationError("image must be an http(s) URL or a path starting with /");
  }
  return text;
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
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date ?? null,
    image: row.image ?? null,
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
    this.#db.exec(BASE_SCHEMA);
    this.#upgrade();
    this.#db.exec(CURRENT_SCHEMA);
  }

  close() {
    this.#db.close();
  }

  /**
   * Bring an existing table up to the current shape. v1 stored a `completed`
   * boolean; v2 stores a three-state `status` plus `description` and `image`.
   * Runs in one transaction, so a failure leaves the old data untouched.
   */
  #upgrade() {
    const columns = new Set(
      this.#db
        .prepare("PRAGMA table_info(todos)")
        .all()
        .map((column) => column.name),
    );
    if (columns.has("status") && !columns.has("completed")) return;

    this.#db.exec("BEGIN");
    try {
      this.#db.exec("DROP INDEX IF EXISTS idx_todos_completed");
      if (!columns.has("status")) {
        this.#db.exec("ALTER TABLE todos ADD COLUMN description TEXT");
        this.#db.exec("ALTER TABLE todos ADD COLUMN status TEXT NOT NULL DEFAULT 'not_started'");
        this.#db.exec("ALTER TABLE todos ADD COLUMN image TEXT");
      }
      if (columns.has("completed")) {
        this.#db.exec(
          "UPDATE todos SET status = CASE WHEN completed = 1 THEN 'completed' ELSE 'not_started' END",
        );
        this.#db.exec("ALTER TABLE todos DROP COLUMN completed");
      }
      this.#db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      this.#db.exec("COMMIT");
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  // ------------------------------------------------------------------ queries

  /** To-dos newest first, with unfinished work listed before completed work. */
  listTodos({ filter = "all", query = "" } = {}) {
    if (!STATUS_FILTERS.includes(filter)) {
      throw new ValidationError(`filter must be one of: ${STATUS_FILTERS.join(", ")}`);
    }
    if (typeof query !== "string") throw new ValidationError("query must be a string");

    const clauses = [];
    const params = [];
    if (filter === "open") {
      clauses.push("status != 'completed'");
    } else if (filter !== "all") {
      clauses.push("status = ?");
      params.push(filter);
    }

    const term = query.trim();
    if (term) {
      clauses.push("(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(term)}%`;
      params.push(like, like);
    }

    let sql = "SELECT * FROM todos";
    if (clauses.length > 0) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY (status = 'completed') ASC, created_at DESC, id DESC";

    return this.#db
      .prepare(sql)
      .all(...params)
      .map(rowToTodo);
  }

  getTodo(todoId) {
    return rowToTodo(this.#fetch(cleanTodoId(todoId)));
  }

  /** Counts per state, which is what the dashboard's donut charts display. */
  stats() {
    const row = this.#db
      .prepare(
        "SELECT COUNT(*) AS total," +
          " COALESCE(SUM(status = 'completed'), 0) AS completed," +
          " COALESCE(SUM(status = 'in_progress'), 0) AS in_progress," +
          " COALESCE(SUM(status = 'not_started'), 0) AS not_started," +
          " COALESCE(SUM(status != 'completed'), 0) AS open" +
          " FROM todos",
      )
      .get();
    return {
      total: row.total,
      completed: row.completed,
      in_progress: row.in_progress,
      not_started: row.not_started,
      open: row.open,
    };
  }

  // ----------------------------------------------------------------- mutation

  createTodo(
    title,
    {
      description = null,
      status = DEFAULT_STATUS,
      priority = DEFAULT_PRIORITY,
      due_date: dueDate = null,
      image = null,
    } = {},
  ) {
    const statusValue = cleanStatus(status);
    const now = utcNow();

    const info = this.#db
      .prepare(
        "INSERT INTO todos" +
          " (title, description, status, priority, due_date, image, created_at, updated_at, completed_at)" +
          " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        cleanTitle(title),
        cleanDescription(description),
        statusValue,
        cleanPriority(priority),
        cleanDueDate(dueDate),
        cleanImage(image),
        now,
        now,
        statusValue === "completed" ? now : null,
      );

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

    // Validate every field before writing any of them, so one bad value cannot
    // leave a half-applied update behind.
    const assignments = {};
    for (const [field, raw] of Object.entries(changes)) {
      if (field === "title") assignments.title = cleanTitle(raw);
      else if (field === "description") assignments.description = cleanDescription(raw);
      else if (field === "status") assignments.status = cleanStatus(raw);
      else if (field === "priority") assignments.priority = cleanPriority(raw);
      else if (field === "due_date") assignments.due_date = cleanDueDate(raw);
      else assignments.image = cleanImage(raw);
    }

    this.#fetch(id); // surfaces a 404 for unknown ids
    if (Object.keys(assignments).length === 0) return this.getTodo(id);

    if ("status" in assignments) {
      assignments.completed_at = assignments.status === "completed" ? utcNow() : null;
    }
    assignments.updated_at = utcNow();

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
    const info = this.#db.prepare("DELETE FROM todos WHERE status = 'completed'").run();
    return Math.max(info.changes, 0);
  }

  // ------------------------------------------------------------------- private

  #fetch(todoId) {
    const row = this.#db.prepare("SELECT * FROM todos WHERE id = ?").get(todoId);
    if (row === undefined) throw new NotFoundError(`to-do ${todoId} was not found`);
    return row;
  }
}
