/**
 * End-to-end tests for the HTTP API: a real server on a real socket, driven
 * with the global fetch client.
 *
 * Run with: npm test   (or: node --test test/)
 */

import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import { ALLOWED_METHODS, createApp } from "../src/app.js";
import { TodoStore } from "../src/store.js";

let store;
let server;
let baseUrl;

before(async () => {
  store = new TodoStore(":memory:");
  server = createApp(store, { logRequests: false }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
  store.close();
});

beforeEach(() => {
  for (const todo of store.listTodos()) store.deleteTodo(todo.id);
});

/** Send a request and decode it, returning errors as data instead of throwing. */
async function call(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null; // non-JSON payload, such as the plain-text 404
  }
  return { status: response.status, headers: response.headers, body: json, text };
}

/** A request with a hand-written Content-Length, for the body-size limit. */
function rawRequest(path, { method = "GET", headers = {}, body = "" } = {}) {
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname, port, path, method, headers }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        text += chunk;
      });
      response.on("end", () => resolve({ status: response.statusCode, text }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

async function create(title, fields = {}) {
  const response = await call("POST", "/api/todos", { title, ...fields });
  assert.equal(response.status, 201, response.text);
  return response.body.todo;
}

async function listTodos(path = "/api/todos") {
  const response = await call("GET", path);
  assert.equal(response.status, 200, response.text);
  return response.body.todos;
}

describe("health and static files", () => {
  it("answers the health probe", async () => {
    const response = await call("GET", "/api/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: "ok" });
    assert.match(response.headers.get("content-type"), /json/);
  });

  it("serves the index page", async () => {
    const response = await call("GET", "/");

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(response.text, /<title>Tasks<\/title>/);
    assert.match(response.text, /id="composer"/);
  });

  it("serves the scripts and styles", async () => {
    const script = await call("GET", "/app.js");
    assert.equal(script.status, 200);
    assert.match(script.text, /"use strict"/);

    const styles = await call("GET", "/styles.css");
    assert.equal(styles.status, 200);
    assert.match(styles.text, /\.task/);
  });

  it("404s for an unknown file", async () => {
    const response = await call("GET", "/does-not-exist.html");

    assert.equal(response.status, 404);
  });

  it("cannot be tricked into serving files outside the public directory", async () => {
    const response = await call("GET", "/..%2Fpackage.json");

    assert.equal(response.status, 404);
    assert.doesNotMatch(response.text, /todo-list-webapp/);
  });
});

describe("POST /api/todos", () => {
  it("creates a to-do with defaults and a Location header", async () => {
    const response = await call("POST", "/api/todos", { title: "Walk the dog" });

    assert.equal(response.status, 201);
    assert.equal(response.body.todo.title, "Walk the dog");
    assert.equal(response.body.todo.completed, false);
    assert.equal(response.body.todo.priority, "medium");
    assert.equal(response.body.todo.due_date, null);
    assert.equal(response.headers.get("location"), `/api/todos/${response.body.todo.id}`);
  });

  it("accepts a priority and due date", async () => {
    const todo = await create("Pay rent", { priority: "high", due_date: "2031-06-01" });

    assert.equal(todo.priority, "high");
    assert.equal(todo.due_date, "2031-06-01");
  });

  it("rejects invalid payloads without creating anything", async () => {
    const cases = [
      [{}, "title must be a string"],
      [{ title: "" }, "must not be empty"],
      [{ title: "ok", priority: "urgent" }, "priority must be one of"],
      [{ title: "ok", due_date: "next week" }, "YYYY-MM-DD"],
    ];

    for (const [payload, message] of cases) {
      const response = await call("POST", "/api/todos", payload);
      assert.equal(response.status, 400, JSON.stringify(payload));
      assert.match(response.body.error, new RegExp(message));
    }
    assert.deepEqual(await listTodos(), []);
  });

  it("rejects malformed JSON", async () => {
    const response = await call("POST", "/api/todos", "{not json");

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "request body must be valid UTF-8 JSON");
  });

  it("rejects a body that is not a JSON object", async () => {
    const response = await call("POST", "/api/todos", ["task"]);

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "request body must be a JSON object");
  });

  it("rejects a missing body", async () => {
    const response = await call("POST", "/api/todos");

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "request body must be a JSON object");
  });

  it("rejects a body above the size limit", async () => {
    const body = JSON.stringify({ title: "ok", padding: "x".repeat(70000) });

    const response = await rawRequest("/api/todos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Connection: "close",
      },
      body,
    });

    assert.equal(response.status, 400);
    assert.match(response.text, /at most/);
  });
});

describe("GET /api/todos", () => {
  it("lists open to-dos first, newest first", async () => {
    const first = await create("First");
    const second = await create("Second");
    await call("PATCH", `/api/todos/${first.id}`, { completed: true });

    assert.deepEqual(
      (await listTodos()).map((todo) => todo.id),
      [second.id, first.id],
    );
  });

  it("filters by status", async () => {
    const done = await create("Done");
    await create("Open");
    await call("PATCH", `/api/todos/${done.id}`, { completed: true });

    assert.deepEqual(
      (await listTodos("/api/todos?status=active")).map((todo) => todo.title),
      ["Open"],
    );
    assert.deepEqual(
      (await listTodos("/api/todos?status=completed")).map((todo) => todo.title),
      ["Done"],
    );
    assert.equal((await listTodos("/api/todos?status=all")).length, 2);
  });

  it("rejects an unknown status", async () => {
    const response = await call("GET", "/api/todos?status=archived");

    assert.equal(response.status, 400);
    assert.match(response.body.error, /status must be one of/);
    assert.match(response.headers.get("content-type"), /json/);
  });

  it("searches titles", async () => {
    await create("Buy milk");
    await create("Walk the dog");

    assert.deepEqual(
      (await listTodos("/api/todos?q=milk")).map((todo) => todo.title),
      ["Buy milk"],
    );
  });

  it("rejects an over-long search term", async () => {
    const response = await call("GET", `/api/todos?q=${"a".repeat(201)}`);

    assert.equal(response.status, 400);
    assert.match(response.body.error, /q must be at most/);
  });

  it("returns a single to-do", async () => {
    const created = await create("Only one");

    const response = await call("GET", `/api/todos/${created.id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.todo, created);
  });

  it("404s for an unknown to-do", async () => {
    const response = await call("GET", "/api/todos/4242");

    assert.equal(response.status, 404);
    assert.match(response.body.error, /4242/);
  });

  it("404s for a non-numeric id", async () => {
    const response = await call("GET", "/api/todos/not-a-number");

    assert.equal(response.status, 404);
    assert.match(response.body.error, /unknown endpoint/);
  });

  it("counts every state in /api/stats", async () => {
    const done = await create("Done");
    await create("Open");
    await call("PATCH", `/api/todos/${done.id}`, { completed: true });

    const response = await call("GET", "/api/stats");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { total: 2, active: 1, completed: 1 });
  });

  it("404s for an unknown API endpoint", async () => {
    const response = await call("GET", "/api/nope");

    assert.equal(response.status, 404);
    assert.match(response.body.error, /unknown endpoint/);
  });
});

describe("PATCH /api/todos/:id", () => {
  it("updates title, priority and due date", async () => {
    const created = await create("Draft");

    const response = await call("PATCH", `/api/todos/${created.id}`, {
      title: "Finished draft",
      priority: "high",
      due_date: "2031-02-03",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.todo.title, "Finished draft");
    assert.equal(response.body.todo.priority, "high");
    assert.equal(response.body.todo.due_date, "2031-02-03");
    assert.equal(response.body.todo.created_at, created.created_at);
  });

  it("completes and reopens a to-do", async () => {
    const created = await create("Ship it");

    const done = await call("PATCH", `/api/todos/${created.id}`, { completed: true });
    assert.equal(done.body.todo.completed, true);
    assert.ok(done.body.todo.completed_at, "expected completed_at to be set");

    const reopened = await call("PATCH", `/api/todos/${created.id}`, { completed: false });
    assert.equal(reopened.body.todo.completed, false);
    assert.equal(reopened.body.todo.completed_at, null);
  });

  it("rejects unknown fields", async () => {
    const created = await create("Task");

    const response = await call("PATCH", `/api/todos/${created.id}`, { colour: "red" });

    assert.equal(response.status, 400);
    assert.match(response.body.error, /unknown field/);
  });

  it("rejects invalid values", async () => {
    const created = await create("Task");

    for (const payload of [
      { title: "  " },
      { completed: "yes" },
      { priority: "someday" },
      { due_date: "01/02/2031" },
    ]) {
      const response = await call("PATCH", `/api/todos/${created.id}`, payload);
      assert.equal(response.status, 400, JSON.stringify(payload));
    }
  });

  it("404s for an unknown to-do", async () => {
    const response = await call("PATCH", "/api/todos/9999", { title: "Nope" });

    assert.equal(response.status, 404);
    assert.match(response.body.error, /9999/);
  });

  it("requires a request body", async () => {
    const created = await create("Task");

    const response = await call("PATCH", `/api/todos/${created.id}`);

    assert.equal(response.status, 400);
    assert.match(response.body.error, /JSON object/);
  });
});

describe("DELETE and clear-completed", () => {
  it("deletes a single to-do", async () => {
    const created = await create("Temporary");

    const response = await call("DELETE", `/api/todos/${created.id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { deleted: created.id });
    assert.deepEqual(await listTodos(), []);
  });

  it("404s when deleting an unknown to-do", async () => {
    const response = await call("DELETE", "/api/todos/9999");

    assert.equal(response.status, 404);
    assert.match(response.body.error, /9999/);
  });

  it("clears only completed to-dos", async () => {
    const keep = await create("Keep");
    for (const title of ["Drop A", "Drop B"]) {
      const done = await create(title);
      await call("PATCH", `/api/todos/${done.id}`, { completed: true });
    }

    const response = await call("POST", "/api/todos/clear-completed");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { deleted: 2 });
    assert.deepEqual(
      (await listTodos()).map((todo) => todo.id),
      [keep.id],
    );
  });

  it("reports zero when nothing is completed", async () => {
    await create("Open");

    const response = await call("POST", "/api/todos/clear-completed");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { deleted: 0 });
  });
});

describe("methods and payload fidelity", () => {
  it("405s for an unsupported method on a known path", async () => {
    const response = await call("PUT", "/api/todos", { title: "x" });

    assert.equal(response.status, 405);
    assert.match(response.body.error, /not allowed/);
    assert.equal(response.headers.get("allow"), ALLOWED_METHODS);
  });

  it("advertises the allowed methods", async () => {
    const response = await call("OPTIONS", "/api/todos");

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("allow"), ALLOWED_METHODS);
  });

  it("round-trips titles containing markup unchanged", async () => {
    const title = '<script>alert("xss")</script> & "quotes"';

    const created = await create(title);

    assert.equal(created.title, title);
    assert.deepEqual(
      (await listTodos()).map((todo) => todo.title),
      [title],
    );
  });
});
