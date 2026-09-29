/** Shapes returned by the Express API in ../../src. */

export type Priority = "low" | "medium" | "high";

export type StatusFilter = "all" | "active" | "completed";

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Stats {
  total: number;
  active: number;
  completed: number;
}

/** The payload accepted by `POST /api/todos`. */
export interface TodoDraft {
  title: string;
  priority: Priority;
  due_date: string | null;
}

/** The payload accepted by `PATCH /api/todos/:id`. */
export interface TodoPatch {
  title?: string;
  completed?: boolean;
  priority?: Priority;
  due_date?: string | null;
}
