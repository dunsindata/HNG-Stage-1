/** Shapes returned by the Express API in ../../src. */

export type Priority = "low" | "medium" | "high";

/** The three states a task moves through on the board. */
export type TaskStatus = "not_started" | "in_progress" | "completed";

/** Values accepted by the API's `filter` query parameter. */
export type StatusFilter = "all" | TaskStatus | "open";

/** The sidebar sections of the dashboard. */
export type ViewKey = "dashboard" | "vital" | "mine" | "categories" | "settings" | "help";

export interface Todo {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Stats {
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
  open: number;
}

/** The payload accepted by `POST /api/todos`. */
export interface TodoDraft {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  due_date?: string | null;
  image?: string | null;
}

/** The payload accepted by `PATCH /api/todos/:id`. */
export interface TodoPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  due_date?: string | null;
  image?: string | null;
}
