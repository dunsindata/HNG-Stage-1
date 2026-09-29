/**
 * Typed client for the JSON API served by the Express app in ../../src.
 * Vite proxies /api to that server in development, so a relative path is all
 * the browser ever needs and there is no CORS configuration to maintain.
 */

import type { Stats, StatusFilter, Todo, TodoDraft, TodoPatch } from "./types";

const BASE = "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Shape guards, not a schema: the API is ours and has its own test suite. */
function toTodo(value: unknown): Todo {
  if (!isRecord(value)) throw new ApiError("The server sent an unexpected task", 0);
  return {
    id: Number(value.id),
    title: String(value.title),
    completed: value.completed === true,
    priority: (value.priority as Todo["priority"]) ?? "medium",
    due_date: typeof value.due_date === "string" ? value.due_date : null,
    created_at: String(value.created_at),
    updated_at: String(value.updated_at),
    completed_at: typeof value.completed_at === "string" ? value.completed_at : null,
  };
}

function toTodoList(value: unknown): Todo[] {
  if (!isRecord(value) || !Array.isArray(value.todos)) {
    throw new ApiError("The server sent an unexpected task list", 0);
  }
  return value.todos.map(toTodo);
}

function toStats(value: unknown): Stats {
  if (!isRecord(value)) throw new ApiError("The server sent unexpected counts", 0);
  return {
    total: Number(value.total),
    active: Number(value.active),
    completed: Number(value.completed),
  };
}

function unwrapTodo(payload: unknown): Todo {
  if (!isRecord(payload)) throw new ApiError("The server sent an unexpected task", 0);
  return toTodo(payload.todo);
}

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (payload: unknown) => T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("Could not reach the server — is it still running?", 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return parse(payload);
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const ignore = () => undefined;

export function fetchTodos({ status, query }: { status: StatusFilter; query: string }): Promise<Todo[]> {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (query) params.set("q", query);
  const suffix = params.toString();
  return request(`/todos${suffix ? `?${suffix}` : ""}`, {}, toTodoList);
}

export function fetchStats(): Promise<Stats> {
  return request("/stats", {}, toStats);
}

export function createTodo(draft: TodoDraft): Promise<Todo> {
  return request("/todos", jsonInit("POST", draft), unwrapTodo);
}

export function patchTodo(id: number, patch: TodoPatch): Promise<Todo> {
  return request(`/todos/${id}`, jsonInit("PATCH", patch), unwrapTodo);
}

export function deleteTodo(id: number): Promise<unknown> {
  return request(`/todos/${id}`, { method: "DELETE" }, ignore);
}

export function clearCompleted(): Promise<unknown> {
  return request("/todos/clear-completed", { method: "POST" }, ignore);
}

/** Normalise anything thrown by the client into a message worth showing. */
export function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return String(cause);
}
