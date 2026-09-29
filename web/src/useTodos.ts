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
import type { Stats, StatusFilter, Todo, TodoDraft } from "./types";

const SEARCH_DEBOUNCE_MS = 250;

const EMPTY_STATS: Stats = { total: 0, active: 0, completed: 0 };

export interface UseTodos {
  todos: Todo[];
  stats: Stats;
  status: StatusFilter;
  query: string;
  isLoading: boolean;
  error: string | null;
  setStatus: (status: StatusFilter) => void;
  setQuery: (query: string) => void;
  /** Resolves to `true` when the task was accepted, so the form knows whether to clear. */
  addTodo: (draft: TodoDraft) => Promise<boolean>;
  toggleTodo: (todo: Todo) => void;
  renameTodo: (id: number, title: string) => void;
  removeTodo: (id: number) => void;
  clearCompletedTasks: () => void;
  reportError: (message: string) => void;
  dismissError: () => void;
}

/**
 * All task state for the page: the list, the counts, the current filter and
 * search term, and the actions that mutate them. Every mutation is followed by
 * a refresh, which keeps the list and the counters consistent without the UI
 * having to mirror server state locally.
 */
export function useTodos(): UseTodos {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [status, setStatus] = useState<StatusFilter>("all");
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
        fetchTodos({ status, query: search }),
        fetchStats(),
      ]);
      setTodos(list);
      setStats(counts);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setIsLoading(false);
    }
  }, [status, search]);

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

  const toggleTodo = useCallback(
    (todo: Todo) => {
      void run(() => patchTodo(todo.id, { completed: !todo.completed }));
    },
    [run],
  );

  const renameTodo = useCallback(
    (id: number, title: string) => {
      void run(() => patchTodo(id, { title }));
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
    status,
    query,
    isLoading,
    error,
    setStatus,
    setQuery,
    addTodo,
    toggleTodo,
    renameTodo,
    removeTodo,
    clearCompletedTasks,
    reportError,
    dismissError,
  };
}
