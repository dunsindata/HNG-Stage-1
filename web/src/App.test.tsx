import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { App } from "./App";
import type { Todo } from "./types";

const NOW = "2031-01-15T09:00:00Z";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    title: "Buy milk",
    completed: false,
    priority: "medium",
    due_date: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    ...overrides,
  };
}

/** YYYY-MM-DD in local time, avoiding the UTC shift that toISOString() applies. */
function localIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

interface ApiCall {
  url: string;
  method: string;
  body: unknown;
}

interface FakeApi {
  calls: ApiCall[];
  state: { todos: Todo[]; rejectCreate: boolean; nextId: number };
}

/** A tiny in-memory stand-in for the Express API. */
function installApi(initial: Todo[]): FakeApi {
  const state = {
    todos: [...initial],
    rejectCreate: false,
    nextId: initial.reduce((max, todo) => Math.max(max, todo.id), 0) + 1,
  };
  const calls: ApiCall[] = [];

  const respond = (payload: unknown, status = 200) =>
    ({ ok: status < 400, status, json: async () => payload }) as Response;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (method === "GET" && url.startsWith("/api/todos")) {
        const params = new URLSearchParams(url.split("?")[1] ?? "");
        const status = params.get("status") ?? "all";
        const term = (params.get("q") ?? "").toLowerCase();

        let todos = [...state.todos];
        if (status === "active") todos = todos.filter((todo) => !todo.completed);
        if (status === "completed") todos = todos.filter((todo) => todo.completed);
        if (term) todos = todos.filter((todo) => todo.title.toLowerCase().includes(term));

        return respond({ todos });
      }

      if (method === "GET" && url === "/api/stats") {
        return respond({
          total: state.todos.length,
          active: state.todos.filter((todo) => !todo.completed).length,
          completed: state.todos.filter((todo) => todo.completed).length,
        });
      }

      if (method === "POST" && url === "/api/todos") {
        if (state.rejectCreate) return respond({ error: "title must not be empty" }, 400);
        const created = makeTodo({
          id: state.nextId++,
          title: body.title,
          priority: body.priority ?? "medium",
          due_date: body.due_date ?? null,
        });
        state.todos = [created, ...state.todos];
        return respond({ todo: created }, 201);
      }

      if (method === "POST" && url === "/api/todos/clear-completed") {
        const before = state.todos.length;
        state.todos = state.todos.filter((todo) => !todo.completed);
        return respond({ deleted: before - state.todos.length });
      }

      const item = url.match(/^\/api\/todos\/(\d+)$/);
      if (item) {
        const id = Number(item[1]);
        if (method === "PATCH") {
          state.todos = state.todos.map((todo) => {
            if (todo.id !== id) return todo;
            const next: Todo = { ...todo, ...body, updated_at: NOW };
            if (body.completed === true) next.completed_at = NOW;
            if (body.completed === false) next.completed_at = null;
            return next;
          });
          return respond({ todo: state.todos.find((todo) => todo.id === id) });
        }
        if (method === "DELETE") {
          state.todos = state.todos.filter((todo) => todo.id !== id);
          return respond({ deleted: id });
        }
      }

      return respond({ error: `unhandled ${method} ${url}` }, 404);
    }),
  );

  return { calls, state };
}

function callsTo(api: FakeApi, method: string, urlPart = ""): ApiCall[] {
  return api.calls.filter((call) => call.method === method && call.url.includes(urlPart));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the tasks the API returns", async () => {
    installApi([
      makeTodo({ title: "Buy milk" }),
      makeTodo({ id: 2, title: "Write tests", completed: true }),
    ]);
    render(<App />);

    expect(await screen.findByText("Buy milk")).toBeTruthy();
    expect(screen.getByText("Write tests")).toBeTruthy();
    expect(screen.getByText("1 active · 1 completed · 2 total")).toBeTruthy();
    expect(document.querySelectorAll(".task")).toHaveLength(2);
    expect(document.querySelectorAll(".task.is-completed")).toHaveLength(1);
  });

  it("shows an empty state when there is nothing to do", async () => {
    installApi([]);
    render(<App />);

    expect(await screen.findByText("No tasks yet — add your first one above.")).toBeTruthy();
  });

  it("adds a task and clears the form", async () => {
    const api = installApi([]);
    render(<App />);
    await screen.findByText("No tasks yet — add your first one above.");

    const input = screen.getByLabelText("Task title") as HTMLInputElement;
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "high" } });
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Buy milk")).toBeTruthy();
    expect(input.value).toBe("");
    expect(callsTo(api, "POST", "/api/todos")[0]?.body).toEqual({
      title: "Buy milk",
      priority: "high",
      due_date: null,
    });
  });

  it("refuses to submit a blank title", async () => {
    const api = installApi([]);
    render(<App />);
    await screen.findByText("No tasks yet — add your first one above.");

    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Enter a task title first.")).toBeTruthy();
    expect(callsTo(api, "POST")).toHaveLength(0);
  });

  it("keeps the typed title when the server rejects it", async () => {
    const api = installApi([]);
    api.state.rejectCreate = true;
    render(<App />);

    const input = screen.getByLabelText("Task title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("title must not be empty")).toBeTruthy();
    expect(input.value).toBe("Buy milk");
  });

  it("ticks a task off", async () => {
    const api = installApi([makeTodo({ title: "Buy milk" })]);
    render(<App />);

    fireEvent.click(await screen.findByLabelText('Mark "Buy milk" as complete'));

    await waitFor(() => {
      expect(callsTo(api, "PATCH")[0]?.body).toEqual({ completed: true });
    });
    await waitFor(() => {
      expect(document.querySelectorAll(".task.is-completed")).toHaveLength(1);
    });
  });

  it("cancels an edit with Escape and saves it with Enter", async () => {
    const api = installApi([makeTodo({ title: "Buy milk" })]);
    render(<App />);
    await screen.findByText("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByLabelText("Edit task title") as HTMLInputElement;
    fireEvent.change(editor, { target: { value: "Buy oat milk" } });
    fireEvent.keyDown(editor, { key: "Escape" });

    await waitFor(() => expect(screen.queryByLabelText("Edit task title")).toBeNull());
    expect(callsTo(api, "PATCH")).toHaveLength(0);
    expect(screen.getByText("Buy milk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const again = screen.getByLabelText("Edit task title") as HTMLInputElement;
    fireEvent.change(again, { target: { value: "Buy oat milk" } });
    fireEvent.keyDown(again, { key: "Enter" });

    await waitFor(() => {
      expect(callsTo(api, "PATCH")[0]?.body).toEqual({ title: "Buy oat milk" });
    });
    expect(await screen.findByText("Buy oat milk")).toBeTruthy();
  });

  it("respects a refused delete", async () => {
    const api = installApi([makeTodo({ title: "Buy milk" })]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await screen.findByText("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(callsTo(api, "DELETE")).toHaveLength(0);
    expect(screen.getByText("Buy milk")).toBeTruthy();
  });

  it("deletes a task once confirmed", async () => {
    const api = installApi([makeTodo({ title: "Buy milk" })]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await screen.findByText("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(callsTo(api, "DELETE")).toHaveLength(1));
    expect(await screen.findByText("No tasks yet — add your first one above.")).toBeTruthy();
  });

  it("re-queries the API when the filter changes", async () => {
    const api = installApi([makeTodo({ title: "Buy milk" })]);
    render(<App />);
    await screen.findByText("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: /^Active/ }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.url === "/api/todos?status=active")).toBe(true);
    });
  });

  it("searches titles once the debounce settles", async () => {
    const api = installApi([
      makeTodo({ title: "Buy milk" }),
      makeTodo({ id: 2, title: "Write tests" }),
    ]);
    render(<App />);
    await screen.findByText("Buy milk");

    fireEvent.change(screen.getByLabelText("Search tasks"), { target: { value: "tests" } });

    await waitFor(
      () => {
        expect(api.calls.some((call) => call.url === "/api/todos?q=tests")).toBe(true);
      },
      { timeout: 2000 },
    );
    await waitFor(() => expect(screen.queryByText("Buy milk")).toBeNull());
    expect(screen.getByText("Write tests")).toBeTruthy();
  });

  it("flags a task that is several days overdue", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    installApi([makeTodo({ title: "Old task", due_date: localIso(past) })]);
    render(<App />);
    await screen.findByText("Old task");

    const badge = document.querySelector(".badge--due");
    expect(badge?.textContent?.startsWith("Overdue")).toBe(true);
    expect(badge?.className).toContain("is-overdue");
  });

  it("labels a task due yesterday without the overdue word", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    installApi([makeTodo({ title: "Yesterday task", due_date: localIso(past) })]);
    render(<App />);
    await screen.findByText("Yesterday task");

    const badge = document.querySelector(".badge--due");
    expect(badge?.textContent).toBe("Due yesterday");
    expect(badge?.className).toContain("is-overdue");
  });

  it("explains when the server cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<App />);

    expect(
      await screen.findByText("Could not reach the server — is it still running?"),
    ).toBeTruthy();
  });
});
