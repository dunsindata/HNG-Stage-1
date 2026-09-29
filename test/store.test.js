/**
 * Tests for the SQLite-backed to-do store.
 *
 * Run with: npm test   (or: node --test test/)
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  DEFAULT_PRIORITY,
  MAX_TITLE_LENGTH,
  NotFoundError,
  TodoStore,
  ValidationError,
  cleanCompleted,
  cleanDueDate,
  cleanPriority,
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
    assert.ok(error instanceof ValidationError, `expected ValidationError, got ${error?.name}: ${error?.message}`);
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
      assert.throws(() => cleanTitle(value), rejects(), `expected ${JSON.stringify(value)} to be rejected`);
    }
  });

  it("rejects a title longer than the maximum", () => {
    assert.throws(() => cleanTitle("a".repeat(MAX_TITLE_LENGTH + 1)), rejects(undefined, `at most ${MAX_TITLE_LENGTH}`));
  });
});

describe("cleanPriority", () => {
  it("normalises case and surrounding space", () => {
    assert.equal(cleanPriority(" HIGH "), "high");
    assert.equal(cleanPriority("low"), "low");
  });

  it("rejects unknown values and non-strings", () => {
    assert.throws(() => cleanPriority("urgent"), rejects(undefined, "priority must be one of"));
    assert.throws(() => cleanPriority(3), rejects(undefined, "priority must be a string"));
  });
});

describe("cleanDueDate", () => {
  it("treats null, undefined and blank strings as unset", () => {
    assert.equal(cleanDueDate(null), null);
    assert.equal(cleanDueDate(undefined), null);
    assert.equal(cleanDueDate(""), null);
    assert.equal(cleanDueDate("   "), null);
  });

  it("accepts a valid calendar date", () => {
    assert.equal(cleanDueDate("2030-01-05"), "2030-01-05");
    assert.equal(cleanDueDate(" 2030-12-31 "), "2030-12-31");
    assert.equal(cleanDueDate("2028-02-29"), "2028-02-29");
  });

  it("rejects malformed and impossible dates", () => {
    for (const value of ["tomorrow", "2030-1-5", "2030-02-30", "2030-13-01", "01/02/2030"]) {
      assert.throws(() => cleanDueDate(value), rejects(), `expected "${value}" to be rejected`);
    }
    assert.throws(() => cleanDueDate(20300105), rejects(undefined, "string or null"));
  });
});

describe("cleanCompleted", () => {
  it("accepts only real booleans", () => {
    assert.equal(cleanCompleted(true), true);
    assert.equal(cleanCompleted(false), false);
    for (const value of ["true", 1, 0, null, undefined]) {
      assert.throws(() => cleanCompleted(value), rejects(undefined, "completed must be true or false"));
    }
  });
});

describe("cleanTodoId", () => {
  it("accepts positive integers", () => {
    assert.equal(cleanTodoId(7), 7);
  });

  it("rejects anything else", () => {
    for (const value of [0, -1, 1.5, "7", true, null, undefined, Number.NaN]) {
      assert.throws(() => cleanTodoId(value), rejects(), `expected ${value} to be rejected`);
    }
  });
});

describe("TodoStore.createTodo", () => {
  it("applies sensible defaults", (t) => {
    const store = freshStore(t);

    const todo = store.createTodo("  Buy   milk  ");

    assert.equal(todo.title, "Buy milk");
    assert.equal(todo.completed, false);
    assert.equal(todo.priority, DEFAULT_PRIORITY);
    assert.equal(todo.due_date, null);
    assert.equal(todo.completed_at, null);
    assert.equal(todo.created_at, todo.updated_at);
    assert.match(todo.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(typeof todo.id, "number");
  });

  it("stores priority and due date", (t) => {
    const store = freshStore(t);

    const todo = store.createTodo("File taxes", { priority: "HIGH", due_date: "2031-04-15" });

    assert.equal(todo.priority, "high");
    assert.equal(todo.due_date, "2031-04-15");
  });

  it("assigns increasing ids", (t) => {
    const store = freshStore(t);

    const first = store.createTodo("First");
    const second = store.createTodo("Second");

    assert.ok(second.id > first.id, "expected the second id to be greater");
  });

  it("rejects invalid input without persisting anything", (t) => {
    const store = freshStore(t);

    const cases = [
      [[""], "must not be empty"],
      [["   "], "must not be empty"],
      [[null], "title must be a string"],
      [[42], "title must be a string"],
      [["a".repeat(MAX_TITLE_LENGTH + 1)], "at most"],
      [["ok", { priority: "urgent" }], "priority must be one of"],
      [["ok", { priority: 3 }], "priority must be a string"],
      [["ok", { due_date: "someday" }], "valid 'YYYY-MM-DD' date"],
      [["ok", { due_date: 20310101 }], "string or null"],
    ];

    for (const [args, message] of cases) {
      assert.throws(() => store.createTodo(...args), rejects(undefined, message), `args: ${JSON.stringify(args)}`);
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

  it("raises NotFoundError for a missing or invalid id", (t) => {
    const store = freshStore(t);

    assert.throws(() => store.getTodo(999), NotFoundError);
    assert.throws(() => store.getTodo(0), ValidationError);
  });

  it("starts empty", (t) => {
    assert.deepEqual(freshStore(t).listTodos(), []);
  });

  it("lists open items first and newest first", (t) => {
    const store = freshStore(t);
    const first = store.createTodo("first");
    const second = store.createTodo("second");
    const third = store.createTodo("third");
    store.updateTodo(second.id, { completed: true });

    assert.deepEqual(
      store.listTodos().map((todo) => todo.id),
      [third.id, first.id, second.id],
    );
  });

  it("filters by status", (t) => {
    const store = freshStore(t);
    const done = store.createTodo("done");
    store.createTodo("open");
    store.updateTodo(done.id, { completed: true });

    assert.equal(store.listTodos({ status: "all" }).length, 2);
    assert.deepEqual(
      store.listTodos({ status: "active" }).map((todo) => todo.title),
      ["open"],
    );
    assert.deepEqual(
      store.listTodos({ status: "completed" }).map((todo) => todo.title),
      ["done"],
    );
  });

  it("rejects an unknown status", (t) => {
    assert.throws(() => freshStore(t).listTodos({ status: "archived" }), ValidationError);
  });

  it("searches titles case-insensitively", (t) => {
    const store = freshStore(t);
    store.createTodo("Buy milk");
    store.createTodo("Walk the dog");

    assert.deepEqual(
      store.listTodos({ query: "MILK" }).map((todo) => todo.title),
      ["Buy milk"],
    );
  });

  it("treats search wildcards literally", (t) => {
    const store = freshStore(t);
    store.createTodo("100% done");
    store.createTodo("100 percent done");
    store.createTodo("under_score");

    assert.deepEqual(
      store.listTodos({ query: "100%" }).map((todo) => todo.title),
      ["100% done"],
    );
    assert.deepEqual(
      store.listTodos({ query: "_" }).map((todo) => todo.title),
      ["under_score"],
    );
  });

  it("ignores blank search terms", (t) => {
    const store = freshStore(t);
    store.createTodo("Only task");

    assert.equal(store.listTodos({ query: "   " }).length, 1);
  });

  it("combines status and search", (t) => {
    const store = freshStore(t);
    const done = store.createTodo("Buy milk");
    store.createTodo("Buy bread");
    store.updateTodo(done.id, { completed: true });

    assert.deepEqual(
      store.listTodos({ status: "active", query: "buy" }).map((todo) => todo.title),
      ["Buy bread"],
    );
  });

  it("counts every state", (t) => {
    const store = freshStore(t);
    assert.deepEqual(store.stats(), { total: 0, active: 0, completed: 0 });

    store.createTodo("open");
    const done = store.createTodo("done");
    store.updateTodo(done.id, { completed: true });

    assert.deepEqual(store.stats(), { total: 2, active: 1, completed: 1 });
  });
});

describe("TodoStore.updateTodo", () => {
  it("changes only the fields it is given", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Draft");

    const updated = store.updateTodo(todo.id, {
      title: " Write   the spec ",
      priority: "high",
      due_date: "2031-01-05",
    });

    assert.equal(updated.id, todo.id);
    assert.equal(updated.title, "Write the spec");
    assert.equal(updated.priority, "high");
    assert.equal(updated.due_date, "2031-01-05");
    assert.equal(updated.completed, false);
    assert.equal(updated.created_at, todo.created_at);
    assert.match(updated.updated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("tracks completed_at when completing and reopening", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Ship it");

    const done = store.updateTodo(todo.id, { completed: true });
    assert.equal(done.completed, true);
    assert.ok(done.completed_at, "expected completed_at to be set");

    const reopened = store.updateTodo(todo.id, { completed: false });
    assert.equal(reopened.completed, false);
    assert.equal(reopened.completed_at, null);
  });

  it("can clear a due date", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Clean up", { due_date: "2031-01-05" });

    assert.equal(store.updateTodo(todo.id, { due_date: null }).due_date, null);
  });

  it("is a no-op when given no fields", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    assert.deepEqual(store.updateTodo(todo.id, {}), todo);
  });

  it("rejects unknown fields", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    assert.throws(() => store.updateTodo(todo.id, { colour: "red" }), rejects(undefined, "unknown field"));
  });

  it("rejects invalid values", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    for (const changes of [
      { title: "   " },
      { completed: "yes" },
      { priority: "whenever" },
      { due_date: "31/12/2031" },
    ]) {
      assert.throws(() => store.updateTodo(todo.id, changes), rejects(), `changes: ${JSON.stringify(changes)}`);
    }
  });

  it("rejects a changes argument that is not an object", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    for (const changes of [null, undefined, "title", ["title"], 42]) {
      assert.throws(() => store.updateTodo(todo.id, changes), rejects(undefined, "changes must be an object"));
    }
  });

  it("leaves the record untouched when any field is invalid", (t) => {
    const store = freshStore(t);
    const todo = store.createTodo("Task");

    assert.throws(() => store.updateTodo(todo.id, { title: "Changed", priority: "nope" }), ValidationError);
    assert.deepEqual(store.getTodo(todo.id), todo);
  });

  it("raises NotFoundError for a missing id", (t) => {
    assert.throws(() => freshStore(t).updateTodo(999, { title: "nope" }), NotFoundError);
  });

  it("rejects a non-positive id", (t) => {
    assert.throws(() => freshStore(t).updateTodo(0, { title: "nope" }), ValidationError);
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
    const keep = store.createTodo("Keep");
    for (const title of ["Drop A", "Drop B"]) {
      store.updateTodo(store.createTodo(title).id, { completed: true });
    }

    assert.equal(store.clearCompleted(), 2);
    assert.deepEqual(
      store.listTodos().map((todo) => todo.id),
      [keep.id],
    );
    assert.equal(store.clearCompleted(), 0);
  });
});

describe("TodoStore persistence", () => {
  it("persists data across a reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "todo-store-"));
    const dbPath = join(dir, "todos.db");

    const first = new TodoStore(dbPath);
    const created = first.createTodo("Persist me", { priority: "high", due_date: "2031-12-31" });
    const expected = first.updateTodo(created.id, { completed: true });
    first.close();

    const reopened = new TodoStore(dbPath);
    try {
      assert.deepEqual(reopened.listTodos({ status: "completed" }), [expected]);
    } finally {
      // Close before deleting: Windows keeps a lock on open database files.
      reopened.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores titles with markup verbatim", (t) => {
    const store = freshStore(t);
    const tricky = '<img src=x onerror="alert(1)"> & "quotes"';

    assert.equal(store.getTodo(store.createTodo(tricky).id).title, tricky);
  });
});
