import { useCallback, useEffect, useState } from "react";

import {
  clearCompleted,
  createTodo,
  deleteTodo,
  fetchStats,
  fetchTodos,
  messageOf,
  patchTodo,
} from "./api";
import type { Stats, StatusFilter, TaskStatus, Todo, TodoDraft, TodoPatch } from "./types";

const SEARCH_DEBOUNCE_MS = 250;

const EMPTY_STATS: Stats = {
  total: 0,
  completed: 0,
  in_progress: 0,
  not_started: 0,
  open: 0,
};

export interface UseTodos {
  todos: Todo[];
  stats: Stats;
  filter: StatusFilter;
  query: string;
  isLoading: boolean;
  error: string | null;
  setFilter: (filter: StatusFilter) => void;
  setQuery: (query: string) => void;
  /** Resolves to `true` when the task was accepted, so the form knows whether to clear. */
  addTodo: (draft: TodoDraft) => Promise<boolean>;
  setStatus: (todo: Todo, status: TaskStatus) => void;
  updateTodo: (id: number, patch: TodoPatch) => void;
  removeTodo: (id: number) => void;
  clearCompletedTasks: () => void;
  reportError: (message: string) => void;
  dismissError: () => void;
}

/**
 * All task state for the dashboard: the list, the per-state counts, the active
 * filter and search term, and the actions that mutate them. Every mutation is
 * followed by a refresh, which keeps the list and the donut charts consistent
 * without the UI having to mirror server state locally.
 */
export function useTodos(): UseTodos {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [list, counts] = await Promise.all([
        fetchTodos({ filter, query: search }),
        fetchStats(),
      ]);
      setTodos(list);
      setStats(counts);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setIsLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Run a mutation, then reload; report failures in the banner instead of
   * throwing. The banner is cleared here rather than in `refresh`, so a slow
   * background reload cannot wipe an error a user action has just raised.
   */
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setError(null);
      try {
        await action();
      } catch (cause) {
        setError(messageOf(cause));
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  const addTodo = useCallback((draft: TodoDraft) => run(() => createTodo(draft)), [run]);

  const setStatus = useCallback(
    (todo: Todo, status: TaskStatus) => {
      void run(() => patchTodo(todo.id, { status }));
    },
    [run],
  );

  const updateTodo = useCallback(
    (id: number, patch: TodoPatch) => {
      void run(() => patchTodo(id, patch));
    },
    [run],
  );

  const removeTodo = useCallback(
    (id: number) => {
      void run(() => deleteTodo(id));
    },
    [run],
  );

  const clearCompletedTasks = useCallback(() => {
    void run(() => clearCompleted());
  }, [run]);

  const reportError = useCallback((message: string) => setError(message), []);
  const dismissError = useCallback(() => setError(null), []);

  return {
    todos,
    stats,
    filter,
    query,
    isLoading,
    error,
    setFilter,
    setQuery,
    addTodo,
    setStatus,
    updateTodo,
    removeTodo,
    clearCompletedTasks,
    reportError,
    dismissError,
  };
}
