import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  clearCompleted,
  createTodo,
  deleteTodo,
  fetchStats,
  fetchTodos,
  messageOf,
  patchTodo,
} from "./api";
import type { Todo } from "./types";

const TODO: Todo = {
  id: 1,
  title: "Buy milk",
  completed: false,
  priority: "medium",
  due_date: null,
  created_at: "2031-01-15T09:00:00Z",
  updated_at: "2031-01-15T09:00:00Z",
  completed_at: null,
};

/** A minimal stand-in: the client only touches ok/status/json. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function stubFetch(implementation: (url: string, init?: RequestInit) => Promise<Response>) {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    implementation(String(input), init),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function firstUrl(mock: ReturnType<typeof stubFetch>): string {
  return String(mock.mock.calls[0]?.[0]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTodos", () => {
  it("asks for the plain list when unfiltered", async () => {
    const mock = stubFetch(async () => jsonResponse({ todos: [TODO] }));

    const todos = await fetchTodos({ status: "all", query: "" });

    expect(firstUrl(mock)).toBe("/api/todos");
    expect(todos).toHaveLength(1);
    expect(todos[0]?.title).toBe("Buy milk");
  });

  it("encodes the status filter and search term", async () => {
    const mock = stubFetch(async () => jsonResponse({ todos: [] }));

    await fetchTodos({ status: "completed", query: "milk & bread" });

    expect(firstUrl(mock)).toBe("/api/todos?status=completed&q=milk+%26+bread");
  });

  it("rejects when the server sends an error payload", async () => {
    stubFetch(async () => jsonResponse({ error: "status must be one of: all, active, completed" }, 400));

    await expect(fetchTodos({ status: "all", query: "" })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "status must be one of: all, active, completed",
    });
  });

  it("rejects a list payload it cannot understand", async () => {
    stubFetch(async () => jsonResponse({ nope: true }));

    await expect(fetchTodos({ status: "all", query: "" })).rejects.toBeInstanceOf(ApiError);
  });

  it("explains a connection failure", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(fetchTodos({ status: "all", query: "" })).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server — is it still running?",
    });
  });
});

describe("fetchStats", () => {
  it("reads the counters", async () => {
    stubFetch(async () => jsonResponse({ total: 3, active: 2, completed: 1 }));

    await expect(fetchStats()).resolves.toEqual({ total: 3, active: 2, completed: 1 });
  });
});

describe("mutations", () => {
  it("POSTs the draft as JSON", async () => {
    const mock = stubFetch(async () => jsonResponse({ todo: TODO }, 201));

    const created = await createTodo({ title: "Buy milk", priority: "high", due_date: "2031-02-01" });

    expect(mock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ title: "Buy milk", priority: "high", due_date: "2031-02-01" }),
    });
    expect(created.id).toBe(1);
  });

  it("PATCHes only the requested fields", async () => {
    const mock = stubFetch(async () => jsonResponse({ todo: { ...TODO, completed: true } }));

    await patchTodo(7, { completed: true });

    expect(String(mock.mock.calls[0]?.[0])).toBe("/api/todos/7");
    expect(mock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
  });

  it("DELETEs a task and clears completed ones", async () => {
    const mock = stubFetch(async (url) =>
      jsonResponse(url.endsWith("clear-completed") ? { deleted: 2 } : { deleted: 7 }),
    );

    await deleteTodo(7);
    await clearCompleted();

    expect(String(mock.mock.calls[0]?.[0])).toBe("/api/todos/7");
    expect(mock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
    expect(String(mock.mock.calls[1]?.[0])).toBe("/api/todos/clear-completed");
    expect(mock.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
  });
});

describe("messageOf", () => {
  it("uses the message of an Error", () => {
    expect(messageOf(new Error("boom"))).toBe("boom");
  });

  it("stringifies anything else", () => {
    expect(messageOf("plain string")).toBe("plain string");
  });
});
