/**
 * End-to-end tests for the HTTP API: a real server on a real socket, driven
 * with the global fetch client.
 *
 * Run with: npm test   (or: node --test test/api.test.js)
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
  it("serves the index page and 404s unknown files", async () => {
    const page = await call("GET", "/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(page.text, /<title>Tasks<\/title>/);
    assert.equal((await call("GET", "/does-not-exist.html")).status, 404);
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
    const { todo } = response.body;
    assert.equal(todo.title, "Walk the dog");
    assert.equal(todo.status, "not_started");
    assert.equal(todo.priority, "medium");
    assert.equal(todo.description, null);
    assert.equal(todo.due_date, null);
    assert.equal(todo.image, null);
    assert.equal(todo.completed_at, null);
    assert.equal(response.headers.get("location"), `/api/todos/${todo.id}`);
  });

  it("accepts description, status, priority, due date and image", async () => {
    const todo = await create("Attend Nisha's Birthday Party", {
      description: "Buy gifts on the way and pick up cake.",
      status: "in_progress",
      priority: "high",
      due_date: "2031-06-01",
      image: "https://example.com/party.png",
    });

    assert.equal(todo.description, "Buy gifts on the way and pick up cake.");
    assert.equal(todo.status, "in_progress");
    assert.equal(todo.priority, "high");
    assert.equal(todo.due_date, "2031-06-01");
    assert.equal(todo.image, "https://example.com/party.png");
  });

  it("rejects invalid payloads without creating anything", async () => {
    const cases = [
      [{}, "title must be a string"],
      [{ title: "" }, "must not be empty"],
      [{ title: "ok", priority: "urgent" }, "priority must be one of"],
      [{ title: "ok", status: "done" }, "status must be one of"],
      [{ title: "ok", due_date: "next week" }, "YYYY-MM-DD"],
      [{ title: "ok", image: "javascript:alert(1)" }, "image must be an"],
      [{ title: "ok", description: 42 }, "string or null"],
    ];

    for (const [payload, message] of cases) {
      const response = await call("POST", "/api/todos", payload);
      assert.equal(response.status, 400, JSON.stringify(payload));
      assert.match(response.body.error, new RegExp(message));
    }
    assert.deepEqual(await listTodos(), []);
  });

  it("rejects malformed, non-object, missing and oversized bodies", async () => {
    const malformed = await call("POST", "/api/todos", "{not json");
    assert.equal(malformed.body.error, "request body must be valid UTF-8 JSON");

    const notObject = await call("POST", "/api/todos", ["task"]);
    assert.equal(notObject.body.error, "request body must be a JSON object");

    const missing = await call("POST", "/api/todos");
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error, "request body must be a JSON object");

    const body = JSON.stringify({ title: "ok", padding: "x".repeat(70000) });
    const huge = await rawRequest("/api/todos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Connection: "close",
      },
      body,
    });
    assert.equal(huge.status, 400);
    assert.match(huge.text, /at most/);
  });
});

describe("GET /api/todos", () => {
  it("lists unfinished work first, newest first", async () => {
    const first = await create("First");
    const second = await create("Second");
    await call("PATCH", `/api/todos/${first.id}`, { status: "completed" });

    assert.deepEqual(
      (await listTodos()).map((todo) => todo.id),
      [second.id, first.id],
    );
  });

  it("filters by state", async () => {
    const done = await create("Done", { status: "completed" });
    const running = await create("Running", { status: "in_progress" });
    const waiting = await create("Waiting");

    assert.equal((await listTodos("/api/todos?filter=all")).length, 3);
    assert.deepEqual(
      (await listTodos("/api/todos?filter=open")).map((todo) => todo.id),
      [waiting.id, running.id],
    );
    assert.deepEqual(
      (await listTodos("/api/todos?filter=in_progress")).map((todo) => todo.id),
      [running.id],
    );
    assert.deepEqual(
      (await listTodos("/api/todos?filter=completed")).map((todo) => todo.id),
      [done.id],
    );
    assert.deepEqual(
      (await listTodos("/api/todos?filter=not_started")).map((todo) => todo.id),
      [waiting.id],
    );
  });

  it("rejects an unknown filter", async () => {
    const response = await call("GET", "/api/todos?filter=archived");

    assert.equal(response.status, 400);
    assert.match(response.body.error, /filter must be one of/);
    assert.match(response.headers.get("content-type"), /json/);
  });

  it("searches titles and descriptions", async () => {
    await create("Buy milk");
    await create("Plan landing page", { description: "Hero section AND CTA" });

    assert.deepEqual(
      (await listTodos("/api/todos?q=milk")).map((todo) => todo.title),
      ["Buy milk"],
    );
    assert.deepEqual(
      (await listTodos("/api/todos?q=hero")).map((todo) => todo.title),
      ["Plan landing page"],
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

  it("404s for an unknown to-do or a non-numeric id", async () => {
    const missing = await call("GET", "/api/todos/4242");
    assert.equal(missing.status, 404);
    assert.match(missing.body.error, /4242/);

    const bad = await call("GET", "/api/todos/not-a-number");
    assert.equal(bad.status, 404);
    assert.match(bad.body.error, /unknown endpoint/);
  });

  it("counts every state in /api/stats", async () => {
    await create("Done", { status: "completed" });
    await create("Running", { status: "in_progress" });
    await create("Waiting");

    const response = await call("GET", "/api/stats");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      total: 3,
      completed: 1,
      in_progress: 1,
      not_started: 1,
      open: 2,
    });
  });

  it("404s for an unknown API endpoint", async () => {
    const response = await call("GET", "/api/nope");

    assert.equal(response.status, 404);
    assert.match(response.body.error, /unknown endpoint/);
  });
});

describe("PATCH /api/todos/:id", () => {
  it("updates title, description, priority and due date", async () => {
    const created = await create("Draft", { description: "first pass" });

    const response = await call("PATCH", `/api/todos/${created.id}`, {
      title: "Finished draft",
      description: "second pass",
      priority: "high",
      due_date: "2031-02-03",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.todo.title, "Finished draft");
    assert.equal(response.body.todo.description, "second pass");
    assert.equal(response.body.todo.priority, "high");
    assert.equal(response.body.todo.due_date, "2031-02-03");
    assert.equal(response.body.todo.status, created.status, "untouched fields survive");
  });

  it("moves a task through the three states, stamping completed_at", async () => {
    const created = await create("Ship it");

    const running = await call("PATCH", `/api/todos/${created.id}`, { status: "in_progress" });
    assert.equal(running.body.todo.status, "in_progress");
    assert.equal(running.body.todo.completed_at, null);

    const done = await call("PATCH", `/api/todos/${created.id}`, { status: "completed" });
    assert.equal(done.body.todo.status, "completed");
    assert.ok(done.body.todo.completed_at, "expected completed_at to be set");

    const stats = await call("GET", "/api/stats");
    assert.equal(stats.body.completed, 1);
  });

  it("rejects unknown fields, including the retired v1 name", async () => {
    const created = await create("Task");

    for (const payload of [{ colour: "red" }, { completed: true }]) {
      const response = await call("PATCH", `/api/todos/${created.id}`, payload);
      assert.equal(response.status, 400, JSON.stringify(payload));
      assert.match(response.body.error, /unknown field/);
    }
  });

  it("rejects invalid values", async () => {
    const created = await create("Task");

    for (const payload of [
      { title: "  " },
      { status: "done" },
      { priority: "someday" },
      { due_date: "01/02/2031" },
      { image: "javascript:alert(1)" },
      { description: 42 },
    ]) {
      const response = await call("PATCH", `/api/todos/${created.id}`, payload);
      assert.equal(response.status, 400, JSON.stringify(payload));
    }
  });

  it("404s for an unknown to-do and requires a body", async () => {
    const missing = await call("PATCH", "/api/todos/9999", { title: "Nope" });
    assert.equal(missing.status, 404);
    assert.match(missing.body.error, /9999/);

    const created = await create("Task");
    const noBody = await call("PATCH", `/api/todos/${created.id}`);
    assert.equal(noBody.status, 400);
    assert.match(noBody.body.error, /JSON object/);
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
    const running = await create("Running", { status: "in_progress" });
    await create("Drop A", { status: "completed" });
    await create("Drop B", { status: "completed" });

    const response = await call("POST", "/api/todos/clear-completed");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { deleted: 2 });
    assert.deepEqual(
      (await listTodos()).map((todo) => todo.id),
      [running.id, keep.id],
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
  it("answers the health probe", async () => {
    const response = await call("GET", "/api/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: "ok" });
    assert.match(response.headers.get("content-type"), /json/);
  });

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

  it("keeps an image URL intact and refuses a script URL", async () => {
    const ok = await create("With a picture", { image: "/images/dog.jpg" });
    assert.equal(ok.image, "/images/dog.jpg");

    const bad = await call("POST", "/api/todos", {
      title: "Bad picture",
      image: "javascript:alert(1)",
    });
    assert.equal(bad.status, 400);
  });
});
