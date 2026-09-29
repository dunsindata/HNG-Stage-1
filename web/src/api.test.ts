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
  description: "Two litres, semi-skimmed",
  status: "not_started",
  priority: "medium",
  due_date: null,
  image: null,
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

    const todos = await fetchTodos({ filter: "all", query: "" });

    expect(firstUrl(mock)).toBe("/api/todos");
    expect(todos).toHaveLength(1);
    expect(todos[0]?.title).toBe("Buy milk");
    expect(todos[0]?.status).toBe("not_started");
  });

  it("encodes the state filter and search term", async () => {
    const mock = stubFetch(async () => jsonResponse({ todos: [] }));

    await fetchTodos({ filter: "in_progress", query: "milk & bread" });

    expect(firstUrl(mock)).toBe("/api/todos?filter=in_progress&q=milk+%26+bread");
  });

  it("rejects when the server sends an error payload", async () => {
    stubFetch(async () =>
      jsonResponse({ error: "filter must be one of: all, not_started, in_progress, completed, open" }, 400),
    );

    await expect(fetchTodos({ filter: "all", query: "" })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "filter must be one of: all, not_started, in_progress, completed, open",
    });
  });

  it("rejects a list payload it cannot understand", async () => {
    stubFetch(async () => jsonResponse({ nope: true }));

    await expect(fetchTodos({ filter: "all", query: "" })).rejects.toBeInstanceOf(ApiError);
  });

  it("explains a connection failure", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(fetchTodos({ filter: "all", query: "" })).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server — is it still running?",
    });
  });
});

describe("fetchStats", () => {
  it("reads the per-state counters", async () => {
    stubFetch(async () =>
      jsonResponse({ total: 4, completed: 1, in_progress: 1, not_started: 2, open: 3 }),
    );

    await expect(fetchStats()).resolves.toEqual({
      total: 4,
      completed: 1,
      in_progress: 1,
      not_started: 2,
      open: 3,
    });
  });
});

describe("mutations", () => {
  it("POSTs the whole draft as JSON", async () => {
    const mock = stubFetch(async () => jsonResponse({ todo: TODO }, 201));

    const created = await createTodo({
      title: "Buy milk",
      description: "Two litres",
      status: "in_progress",
      priority: "high",
      due_date: "2031-02-01",
      image: "/images/milk.png",
    });

    expect(mock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        title: "Buy milk",
        description: "Two litres",
        status: "in_progress",
        priority: "high",
        due_date: "2031-02-01",
        image: "/images/milk.png",
      }),
    });
    expect(created.id).toBe(1);
  });

  it("PATCHes only the requested fields", async () => {
    const mock = stubFetch(async () => jsonResponse({ todo: { ...TODO, status: "completed" } }));

    await patchTodo(7, { status: "completed" });

    expect(String(mock.mock.calls[0]?.[0])).toBe("/api/todos/7");
    expect(mock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
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
