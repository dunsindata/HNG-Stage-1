/**
 * Tests for the SQLite-backed to-do store.
 *
 * Run with: npm test   (or: node --test test/store.test.js)
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  DEFAULT_PRIORITY,
  DEFAULT_STATUS,
  MAX_IMAGE_LENGTH,
  MAX_TITLE_LENGTH,
  NotFoundError,
  STATUSES,
  TodoStore,
  ValidationError,
  cleanDescription,
  cleanDueDate,
  cleanImage,
  cleanPriority,
  cleanStatus,
  cleanTitle,
  cleanTodoId,
} from "../src/store.js";

/** A store backed by an in-memory database, closed when the test ends. */
function freshStore(t) {
  const store = new TodoStore(":memory:");
  t.after(() => store.close());
  return store;
}

function rejects(fn, message) {
  return (error) => {
    assert.ok(
      error instanceof ValidationError,
      `expected ValidationError, got ${error?.name}: ${error?.message}`,
    );
    if (message !== undefined) {
      assert.ok(
        error.message.includes(message),
        `expected message to include "${message}", got "${error.message}"`,
      );
    }
    return true;
  };
}

describe("cleanTitle", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(cleanTitle("  Buy \t milk \n today "), "Buy milk today");
  });

  it("keeps a title that is exactly the maximum length", () => {
    const title = "a".repeat(MAX_TITLE_LENGTH);
    assert.equal(cleanTitle(title), title);
  });

  it("rejects blank and non-string titles", () => {
    for (const value of ["", "   ", null, undefined, 42, ["task"]]) {
      assert.throws(() => cleanTitle(value), rejects());
    }
  });

  it("rejects a title longer than the maximum", () => {
    assert.throws(
      () => cleanTitle("a".repeat(MAX_TITLE_LENGTH + 1)),
      rejects(undefined, `at most ${MAX_TITLE_LENGTH}`),
    );
  });
});

describe("cleanDescription", () => {
  it("trims and collapses runs of spaces", () => {
    assert.equal(cleanDescription("  buy   the  cake "), "buy the cake");
  });

  it("treats empty values as unset", () => {
    assert.equal(cleanDescription(null), null);
    assert.equal(cleanDescription(undefined), null);
    assert.equal(cleanDescription("   "), null);
  });

  it("keeps newlines, so multi-line descriptions survive", () => {
    assert.equal(cleanDescription("line one\nline two"), "line one\nline two");
  });

  it("rejects non-strings", () => {
    for (const value of [42, true, {}]) {
      assert.throws(() => cleanDescription(value), rejects(undefined, "must be a string or null"));
    }
  });
});

describe("cleanStatus", () => {
  it("accepts the three board states, ignoring case", () => {
    for (const status of STATUSES) {
      assert.equal(cleanStatus(` ${status.toUpperCase()} `), status);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["done", "pending", "", 3, null]) {
      assert.throws(() => cleanStatus(value), rejects());
    }
  });
});

describe("cleanPriority", () => {
  it("normalises case and surrounding space", () => {
    assert.equal(cleanPriority(" HIGH "), "high");
  });

  it("rejects unknown values and non-strings", () => {
    assert.throws(() => cleanPriority("urgent"), rejects(undefined, "priority must be one of"));
    assert.throws(() => cleanPriority(3), rejects(undefined, "priority must be a string"));
  });
});

describe("cleanDueDate", () => {
  it("treats null, undefined and blank strings as unset", () => {
    assert.equal(cleanDueDate(null), null);
    assert.equal(cleanDueDate("   "), null);
  });

  it("accepts a valid calendar date", () => {
    assert.equal(cleanDueDate("2030-01-05"), "2030-01-05");
    assert.equal(cleanDueDate(" 2030-12-31 "), "2030-12-31");
    assert.equal(cleanDueDate("2028-02-29"), "2028-02-29");
  });

  it("rejects malformed and impossible dates", () => {
    for (const value of ["tomorrow", "2030-1-5", "2030-02-30", "01/02/2030"]) {
      assert.throws(() => cleanDueDate(value), rejects());
    }
    assert.throws(() => cleanDueDate(20300105), rejects(undefined, "string or null"));
  });
});

describe("cleanImage", () => {
  it("accepts http(s) URLs and site-relative paths", () => {
    assert.equal(cleanImage("https://example.com/a.png"), "https://example.com/a.png");
    assert.equal(cleanImage("http://example.com/a.png"), "http://example.com/a.png");
    assert.equal(cleanImage("/images/a.png"), "/images/a.png");
  });

  it("treats empty values as unset", () => {
    assert.equal(cleanImage(null), null);
    assert.equal(cleanImage("  "), null);
  });

  it("refuses schemes that could execute script in an <img>", () => {
    for (const value of ["javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "file:///x"]) {
      assert.throws(() => cleanImage(value), rejects(undefined, "http(s) URL"));
    }
  });

  it("rejects an over-long URL and non-strings", () => {
    assert.throws(
      () => cleanImage(`https://e.com/${"a".repeat(MAX_IMAGE_LENGTH)}`),
      rejects(undefined, `at most ${MAX_IMAGE_LENGTH}`),
    );
    assert.throws(() => cleanImage(42), rejects(undefined, "URL string or null"));
  });
});

describe("TodoStore.createTodo", () => {
  it("applies sensible defaults", (t) => {
    const store = freshStore(t);

    const todo = store.createTodo("  Buy   milk  ");

    assert.equal(todo.title, "Buy milk");
    assert.equal(todo.status, DEFAULT_STATUS);
    assert.equal(todo.priority, DEFAULT_PRIORITY);
    assert.equal(todo.description, null);
    assert.equal(todo.due_date, null);
    assert.equal(todo.image, null);
    assert.equal(todo.completed_at, null);
    assert.equal(todo.created_at, todo.updated_at);
    assert.match(todo.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(typeof todo.id, "number");
  });

  it("stores every field it is given", (t) => {
    const store = freshStore(t);

    const todo = store.createTodo("Attend Nisha's Birthday Party", {
      description: "Buy gifts on the way and pick up cake.",
      status: "in_progress",
      priority: "HIGH",
      due_date: "2031-04-15",
      image: "https://example.com/party.png",
    });

    assert.equal(todo.description, "Buy gifts on the way and pick up cake.");
    assert.equal(todo.status, "in_progress");
    assert.equal(todo.priority, "high");
    assert.equal(todo.due_date, "2031-04-15");
    assert.equal(todo.image, "https://example.com/party.png");
  });

  it("stamps completed_at when created as completed", (t) => {
    const store = freshStore(t);

    const todo = store.createTodo("Already done", { status: "completed" });

    assert.equal(todo.status, "completed");
    assert.ok(todo.completed_at, "expected completed_at to be set");
  });

  it("rejects invalid input without persisting anything", (t) => {
    const store = freshStore(t);

    const cases = [
      ["", {}, "must not be empty"],
      ["   ", {}, "must not be empty"],
      [null, {}, "title must be a string"],
      ["a".repeat(MAX_TITLE_LENGTH + 1), {}, "at most"],
      ["ok", { priority: "urgent" }, "priority must be one of"],
      ["ok", { status: "done" }, "status must be one of"],
      ["ok", { due_date: "someday" }, "valid 'YYYY-MM-DD' date"],
      ["ok", { image: "javascript:alert(1)" }, "http(s) URL"],
      ["ok", { description: 42 }, "must be a string or null"],
    ];

    for (const [title, fields, message] of cases) {
      assert.throws(
        () => store.createTodo(title, fields),
        rejects(undefined, message),
        `title: ${String(title)} fields: ${JSON.stringify(fields)}`,
      );
    }
    assert.equal(store.stats().total, 0);
  });
});

describe("TodoStore read operations", () => {
  it("returns a stored to-do by id", (t) => {
    const store = freshStore(t);
    const created = store.createTodo("Read me");

    assert.deepEqual(store.getTodo(created.id), created);
  });

  it("raises NotFoundError for a missing id and ValidationError for a bad one", (t) => {
    const store = freshStore(t);

    assert.throws(() => store.getTodo(999), NotFoundError);
    assert.throws(() => store.getTodo(0), ValidationError);
  });

  it("lists unfinished work first, newest first", (t) => {
    const store = freshStore(t);
    const first = store.createTodo("first");
    const second = store.createTodo("second");
    const third = store.createTodo("third");
    store.updateTodo(second.id, { status: "completed" });

    assert.deepEqual(
      store.listTodos().map((todo) => todo.id),
      [third.id, first.id, second.id],
    );
  });

  it("filters by state", (t) => {
    const store = freshStore(t);
    const done = store.createTodo("done", { status: "completed" });
    const running = store.createTodo("running", { status: "in_progress" });
    const waiting = store.createTodo("waiting");

    assert.equal(store.listTodos({ filter: "all" }).length, 3);
    // Same-second rows are ordered newest first, so `waiting` precedes `running`.
    assert.deepEqual(
      store.listTodos({ filter: "open" }).map((todo) => todo.id),
      [waiting.id, running.id],
    );
    assert.deepEqual(
      store.listTodos({ filter: "in_progress" }).map((todo) => todo.id),
      [running.id],
    );
    assert.deepEqual(
      store.listTodos({ filter: "completed" }).map((todo) => todo.id),
      [done.id],
    );
    assert.deepEqual(
      store.listTodos({ filter: "not_started" }).map((todo) => todo.id),
      [waiting.id],
    );
  });

  it("rejects an unknown filter", (t) => {
    assert.throws(() => freshStore(t).listTodos({ filter: "archived" }), ValidationError);
  });

  it("searches titles and descriptions, case-insensitively", (t) => {
    const store = freshStore(t);
    store.createTodo("Buy milk");
    store.createTodo("Plan landing page", { description: "Hero section AND CTA" });

    assert.deepEqual(
      store.listTodos({ query: "MILK" }).map((todo) => todo.title),
      ["Buy milk"],
    );
    assert.deepEqual(
      store.listTodos({ query: "hero section" }).map((todo) => todo.title),
      ["Plan landing page"],
    );
  });

  it("treats search wildcards literally", (t) => {
    const store = freshStore(t);
    store.createTodo("100% done");
    store.createTodo("100 percent done");

    assert.deepEqual(
      store.listTodos({ query: "100%" }).map((todo) => todo.title),
      ["100% done"],
    );
  });

  it("ignores blank search terms", (t) => {
    const store = freshStore(t);
    store.createTodo("Only task");

    assert.equal(store.listTodos({ query: "   " }).length, 1);
  });

  it("counts every state", (t) => {
    const store = freshStore(t);
    assert.deepEqual(store.stats(), {
      total: 0,
      completed: 0,
      in_progress: 0,
      not_started: 0,
      open: 0,
    });

    store.createTodo("a");
    store.createTodo("b", { status: "in_progress" });
    store.createTodo("c", { status: "completed" });

    assert.deepEqual(store.stats(), {
      total: 3,
      completed: 1,
      in_progress: 1,
      not_started: 1,
      open: 2,
    });
  });
});

describe("TodoStore.updateTodo", () => {
  it("changes only the fields it is given", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Draft", { description: "first pass" });

    const updated = store.updateTodo(todo.id, {
      title: " Write the spec ",
      priority: "high",
      due_date: "2031-01-05",
    });

    assert.equal(updated.id, todo.id);
    assert.equal(updated.title, "Write the spec");
    assert.equal(updated.priority, "high");
    assert.equal(updated.due_date, "2031-01-05");
    assert.equal(updated.description, "first pass", "untouched fields must survive");
    assert.equal(updated.status, todo.status);
    assert.equal(updated.created_at, todo.created_at);
  });

  it("stamps and clears completed_at as the status moves", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Ship it");

    const running = store.updateTodo(todo.id, { status: "in_progress" });
    assert.equal(running.status, "in_progress");
    assert.equal(running.completed_at, null);

    const done = store.updateTodo(todo.id, { status: "completed" });
    assert.equal(done.status, "completed");
    assert.ok(done.completed_at, "expected completed_at to be set");

    const reopened = store.updateTodo(todo.id, { status: "not_started" });
    assert.equal(reopened.completed_at, null);
  });

  it("keeps completed_at when editing a completed task's title", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Ship it", { status: "completed" });

    const updated = store.updateTodo(todo.id, { title: "Shipped it" });

    assert.equal(updated.status, "completed");
    assert.equal(updated.completed_at, todo.completed_at);
  });

  it("can clear the description, due date and image", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Clean up", {
      description: "note",
      due_date: "2031-01-05",
      image: "https://example.com/a.png",
    });

    const cleared = store.updateTodo(todo.id, {
      description: null,
      due_date: null,
      image: null,
    });

    assert.equal(cleared.description, null);
    assert.equal(cleared.due_date, null);
    assert.equal(cleared.image, null);
  });

  it("is a no-op when given no fields", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    assert.deepEqual(store.updateTodo(todo.id, {}), todo);
  });

  it("rejects unknown fields, including the retired v1 name", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    assert.throws(
      () => store.updateTodo(todo.id, { colour: "red" }),
      rejects(undefined, "unknown field"),
    );
    assert.throws(
      () => store.updateTodo(todo.id, { completed: true }),
      rejects(undefined, "unknown field"),
    );
  });

  it("rejects invalid values", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    for (const changes of [
      { title: "   " },
      { status: "done" },
      { priority: "whenever" },
      { due_date: "31/12/2031" },
      { image: "javascript:alert(1)" },
      { description: 42 },
    ]) {
      assert.throws(() => store.updateTodo(todo.id, changes), rejects());
    }
  });

  it("rejects a changes argument that is not an object", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    for (const changes of [null, undefined, "title", ["title"], 42]) {
      assert.throws(
        () => store.updateTodo(todo.id, changes),
        rejects(undefined, "changes must be an object"),
      );
    }
  });

  it("leaves the record untouched when any field is invalid", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    assert.throws(
      () => store.updateTodo(todo.id, { title: "Changed", status: "nope" }),
      ValidationError,
    );
    assert.deepEqual(store.getTodo(todo.id), todo);
  });

  it("raises NotFoundError for a missing id", (t) => {
    assert.throws(() => freshStore(t).updateTodo(999, { title: "nope" }), NotFoundError);
  });
});

describe("TodoStore.deleteTodo and clearCompleted", () => {
  it("deletes only the targeted to-do", (t) => {
    const store = freshStore(t);
    const keep = store.createTodo("Keep");
    const drop = store.createTodo("Drop");

    assert.equal(store.deleteTodo(drop.id), drop.id);
    assert.deepEqual(
      store.listTodos().map((todo) => todo.id),
      [keep.id],
    );
    assert.throws(() => store.getTodo(drop.id), NotFoundError);
  });

  it("raises NotFoundError when deleting a missing to-do", (t) => {
    assert.throws(() => freshStore(t).deleteTodo(404), NotFoundError);
  });

  it("clears only completed to-dos and reports how many went", (t) => {
    const store = freshStore(t);
    const running = store.createTodo("Running", { status: "in_progress" });
    const waiting = store.createTodo("Waiting");
    store.createTodo("Drop A", { status: "completed" });
    store.createTodo("Drop B", { status: "completed" });

    assert.equal(store.clearCompleted(), 2);
    assert.deepEqual(
      store.listTodos().map((todo) => todo.id),
      [waiting.id, running.id],
    );
    assert.equal(store.clearCompleted(), 0);
  });
});

describe("schema migration", () => {
  /** Recreate the v1 table so we can prove an old database upgrades cleanly. */
  function seedLegacyDatabase(dbPath) {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
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
    `);
    const insert = legacy.prepare(
      "INSERT INTO todos (title, completed, priority, due_date, created_at, updated_at, completed_at)" +
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    insert.run("Old done task", 1, "high", "2031-01-05", "2031-01-01T09:00:00Z", "2031-01-01T09:00:00Z", "2031-01-01T10:00:00Z");
    insert.run("Old open task", 0, "low", null, "2031-01-01T09:00:00Z", "2031-01-01T09:00:00Z", null);
    legacy.close();
  }

  it("upgrades a v1 database without losing rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "todo-migrate-"));
    const dbPath = join(dir, "todos.db");
    seedLegacyDatabase(dbPath);

    const store = new TodoStore(dbPath);
    try {
      const done = store.getTodo(1);
      const open = store.getTodo(2);

      assert.equal(done.title, "Old done task");
      assert.equal(done.status, "completed", "completed = 1 should become status completed");
      assert.equal(done.priority, "high");
      assert.equal(done.due_date, "2031-01-05");
      assert.equal(done.created_at, "2031-01-01T09:00:00Z");
      assert.equal(done.description, null);
      assert.equal(done.image, null);
      assert.equal(done.completed_at, "2031-01-01T10:00:00Z");

      assert.equal(open.status, "not_started", "completed = 0 should become not_started");
      assert.equal(open.completed_at, null);
      assert.equal(store.stats().total, 2);
      assert.equal(store.stats().completed, 1);
    } finally {
      // Windows keeps a lock on open database files, so close before deleting.
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("drops the retired completed column and is safe to reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "todo-migrate-"));
    const dbPath = join(dir, "todos.db");
    seedLegacyDatabase(dbPath);

    const first = new TodoStore(dbPath);
    const created = first.createTodo("Added after migrating", { status: "in_progress" });
    assert.equal(created.status, "in_progress");
    first.close();

    const second = new TodoStore(dbPath);
    try {
      const columns = second.listTodos().map((todo) => todo.id);
      assert.equal(columns.length, 3);
      const inspect = new DatabaseSync(dbPath);
      const names = inspect
        .prepare("PRAGMA table_info(todos)")
        .all()
        .map((column) => column.name);
      inspect.close();

      assert.ok(names.includes("status"));
      assert.ok(names.includes("description"));
      assert.ok(names.includes("image"));
      assert.ok(!names.includes("completed"), "the v1 boolean column should be gone");
    } finally {
      second.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
