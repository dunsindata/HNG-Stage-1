import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { App } from "./App";
import type { TaskStatus, Todo } from "./types";

const NOW = "2031-01-15T09:00:00Z";
const LATER = "2031-01-17T09:00:00Z";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 1,
    title: "Buy milk",
    description: null,
    status: "not_started",
    priority: "medium",
    due_date: null,
    image: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    ...overrides,
  };
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

/** YYYY-MM-DD in local time, avoiding the UTC shift of toISOString(). */
function localIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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
        const filter = params.get("filter") ?? "all";
        const term = (params.get("q") ?? "").toLowerCase();

        let todos = [...state.todos];
        if (filter === "open") todos = todos.filter((todo) => todo.status !== "completed");
        else if (filter !== "all") todos = todos.filter((todo) => todo.status === filter);
        if (term) {
          todos = todos.filter(
            (todo) =>
              todo.title.toLowerCase().includes(term) ||
              (todo.description ?? "").toLowerCase().includes(term),
          );
        }

        return respond({ todos });
      }

      if (method === "GET" && url === "/api/stats") {
        const count = (status: TaskStatus) => state.todos.filter((t) => t.status === status).length;
        return respond({
          total: state.todos.length,
          completed: count("completed"),
          in_progress: count("in_progress"),
          not_started: count("not_started"),
          open: state.todos.filter((t) => t.status !== "completed").length,
        });
      }

      if (method === "POST" && url === "/api/todos") {
        if (state.rejectCreate) return respond({ error: "title must not be empty" }, 400);
        const created = makeTodo({
          id: state.nextId++,
          title: body.title,
          description: body.description ?? null,
          status: body.status ?? "not_started",
          priority: body.priority ?? "medium",
          due_date: body.due_date ?? null,
          image: body.image ?? null,
        });
        state.todos = [created, ...state.todos];
        return respond({ todo: created }, 201);
      }

      if (method === "POST" && url === "/api/todos/clear-completed") {
        const before = state.todos.length;
        state.todos = state.todos.filter((todo) => todo.status !== "completed");
        return respond({ deleted: before - state.todos.length });
      }

      const item = url.match(/^\/api\/todos\/(\d+)$/);
      if (item) {
        const id = Number(item[1]);
        if (method === "PATCH") {
          state.todos = state.todos.map((todo) => {
            if (todo.id !== id) return todo;
            const next: Todo = { ...todo, ...body, updated_at: LATER };
            if (body.status === "completed") next.completed_at = LATER;
            if (body.status && body.status !== "completed") next.completed_at = null;
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

describe("dashboard shell", () => {
  it("renders the brand, sidebar navigation and welcome bar", async () => {
    installApi([]);
    render(<App />);

    expect(document.querySelector(".brand__accent")?.textContent).toBe("Dash");
    expect(document.querySelector(".brand__rest")?.textContent).toBe("board");

    for (const label of [
      "Dashboard",
      "Vital Task",
      "My Task",
      "Task Categories",
      "Settings",
      "Help",
      "Logout",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    expect(document.querySelector(".welcome__title")?.textContent).toContain("Welcome back, Sundar");
    expect(screen.getByRole("button", { name: "Invite" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Task" })).toBeTruthy();
  });

  it("shows the three status panels", async () => {
    installApi([]);
    render(<App />);

    expect(await screen.findByText("To Do")).toBeTruthy();
    expect(screen.getByText("Task Status")).toBeTruthy();
    expect(screen.getByText("Completed Task")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.getByText("Not Started")).toBeTruthy();
  });

  it("prompts the server with no filter on the dashboard", async () => {
    const api = installApi([]);
    render(<App />);

    await waitFor(() => {
      expect(api.calls.some((call) => call.url === "/api/todos")).toBe(true);
    });
  });
});

describe("task cards", () => {
  it("renders title, description and the meta line", async () => {
    installApi([
      makeTodo({
        title: "Attend Nisha's Birthday Party",
        description: "Buy gifts on the way and pick up cake from the bakery.",
        status: "in_progress",
        priority: "high",
        due_date: null,
      }),
    ]);
    render(<App />);

    await screen.findByText("Attend Nisha's Birthday Party");
    const card = document.querySelector(".task-card") as HTMLElement;
    expect(
      within(card).getByText("Buy gifts on the way and pick up cake from the bakery."),
    ).toBeTruthy();
    expect(within(card).getByText("High")).toBeTruthy();
    expect(within(card).getByText("In Progress")).toBeTruthy();
    expect(card.querySelector(".task-card__meta")?.textContent).toContain("Created on:");
  });

  it("keeps completed work off the board and lists it separately", async () => {
    installApi([
      makeTodo({ id: 1, title: "Walk the dog" }),
      makeTodo({
        id: 2,
        title: "Conduct meeting",
        description: "Meet with the client",
        status: "completed",
        completed_at: LATER,
      }),
    ]);
    render(<App />);

    await screen.findByText("Walk the dog");
    const board = document.querySelector(".panel--board");
    expect(board?.textContent).toContain("Walk the dog");
    expect(board?.textContent).not.toContain("Conduct meeting");

    const donePanel = document.querySelectorAll(".panel")[2];
    expect(donePanel?.textContent).toContain("Conduct meeting");
    expect(donePanel?.textContent).toContain("Completed");
  });

  it("advances a task's state when its dot is clicked", async () => {
    const api = installApi([makeTodo({ title: "Walk the dog" })]);
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: 'Mark "Walk the dog" as In Progress' }),
    );

    await waitFor(() => {
      expect(callsTo(api, "PATCH")[0]?.body).toEqual({ status: "in_progress" });
    });
  });

  it("marks an overdue task", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    installApi([makeTodo({ title: "Old task", due_date: localIso(past) })]);
    render(<App />);

    await screen.findByText("Old task");
    const badge = document.querySelector(".task-card__due");
    expect(badge?.textContent?.startsWith("Overdue")).toBe(true);
    expect(badge?.className).toContain("is-overdue");
  });
});

describe("task status donuts", () => {
  it("shows each state's share of the total", async () => {
    installApi([
      makeTodo({ id: 1, status: "completed", completed_at: LATER }),
      makeTodo({ id: 2, status: "in_progress" }),
      makeTodo({ id: 3, status: "not_started" }),
      makeTodo({ id: 4, status: "not_started" }),
    ]);
    render(<App />);

    await screen.findByText("Task Status");
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Completed: 25%" })).toBeTruthy();
    });
    expect(screen.getByRole("img", { name: "In Progress: 25%" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Not Started: 50%" })).toBeTruthy();
  });

  it("shows 0% for every ring when there are no tasks", async () => {
    installApi([]);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Completed: 0%" })).toBeTruthy();
    });
  });
});

describe("sidebar navigation", () => {
  it("narrows to high-priority open work in Vital Task", async () => {
    installApi([
      makeTodo({ id: 1, title: "Urgent thing", priority: "high" }),
      makeTodo({ id: 2, title: "Someday thing", priority: "low" }),
      makeTodo({ id: 3, title: "Finished thing", priority: "high", status: "completed" }),
    ]);
    render(<App />);
    await screen.findByText("Urgent thing");

    fireEvent.click(screen.getByRole("button", { name: "Vital Task" }));

    await waitFor(() => {
      const board = document.querySelector(".panel--board");
      expect(board?.textContent).toContain("Urgent thing");
      expect(board?.textContent).not.toContain("Someday thing");
      expect(board?.textContent).not.toContain("Finished thing");
    });
  });

  it("lists every task in My Task", async () => {
    installApi([
      makeTodo({ id: 1, title: "Open thing" }),
      makeTodo({ id: 2, title: "Finished thing", status: "completed" }),
    ]);
    render(<App />);
    await screen.findByText("Open thing");

    fireEvent.click(screen.getByRole("button", { name: "My Task" }));

    await waitFor(() => {
      const board = document.querySelector(".panel--board");
      expect(board?.textContent).toContain("Open thing");
      expect(board?.textContent).toContain("Finished thing");
    });
  });

  it("lets the server narrow the Categories view", async () => {
    const api = installApi([
      makeTodo({ id: 1, status: "in_progress" }),
      makeTodo({ id: 2, status: "completed" }),
    ]);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Task Categories" }));
    await waitFor(() => {
      expect(api.calls.some((call) => call.url.includes("filter=not_started"))).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "In Progress" }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.url === "/api/todos?filter=in_progress")).toBe(true);
    });
  });

  it("shows a placeholder panel for Settings", async () => {
    installApi([]);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(document.querySelector(".panel")?.textContent).toContain("stored locally in SQLite");
    });
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Task" })).toBeNull();
  });
});

describe("adding a task", () => {
  it("posts the whole draft from the modal", async () => {
    const api = installApi([]);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add Task" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Title"), {
      target: { value: "Plan the launch" },
    });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "Book the venue" },
    });
    fireEvent.change(within(dialog).getByLabelText("Status"), {
      target: { value: "in_progress" },
    });
    fireEvent.change(within(dialog).getByLabelText("Priority"), {
      target: { value: "high" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Task" }));

    await waitFor(() => {
      expect(callsTo(api, "POST", "/api/todos")[0]?.body).toEqual({
        title: "Plan the launch",
        description: "Book the venue",
        status: "in_progress",
        priority: "high",
        due_date: null,
        image: null,
      });
    });
    expect(await screen.findByText("Plan the launch")).toBeTruthy();
  });

  it("refuses a blank title without calling the API", async () => {
    const api = installApi([]);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add Task" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Task" }));

    expect(await screen.findByText("Give the task a title first.")).toBeTruthy();
    expect(callsTo(api, "POST")).toHaveLength(0);
  });

  it("reports a rejected task and keeps the modal open", async () => {
    const api = installApi([]);
    api.state.rejectCreate = true;
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add Task" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Nope" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Task" }));

    expect(await screen.findByText("title must not be empty")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("search, delete and errors", () => {
  it("asks the server for a search once the debounce settles", async () => {
    const api = installApi([
      makeTodo({ id: 1, title: "Buy milk" }),
      makeTodo({ id: 2, title: "Write tests" }),
    ]);
    render(<App />);
    await screen.findByText("Buy milk");

    fireEvent.change(screen.getByLabelText("Search your task here"), {
      target: { value: "tests" },
    });

    await waitFor(
      () => {
        expect(api.calls.some((call) => call.url === "/api/todos?q=tests")).toBe(true);
      },
      { timeout: 2000 },
    );
    await waitFor(() => expect(screen.queryByText("Buy milk")).toBeNull());
  });

  it("respects a refused delete and deletes once confirmed", async () => {
    const api = installApi([makeTodo({ title: "Walk the dog" })]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await screen.findByText("Walk the dog");

    fireEvent.click(screen.getByRole("button", { name: "Delete Walk the dog" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(callsTo(api, "DELETE")).toHaveLength(0);

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete Walk the dog" }));

    await waitFor(() => expect(callsTo(api, "DELETE")).toHaveLength(1));
    expect(await screen.findByText("Nothing on the board yet — add your first task.")).toBeTruthy();
  });

  it("clears every completed task from the board footer", async () => {
    const api = installApi([
      makeTodo({ id: 1, title: "Open thing" }),
      makeTodo({ id: 2, title: "Done thing", status: "completed" }),
    ]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);
    await screen.findByText("Open thing");

    fireEvent.click(screen.getByRole("button", { name: /Clear 1 completed task/ }));

    await waitFor(() => {
      expect(callsTo(api, "POST", "clear-completed")).toHaveLength(1);
    });
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
