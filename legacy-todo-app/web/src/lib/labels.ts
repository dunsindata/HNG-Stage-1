import type { Priority, TaskStatus } from "../types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Board order, which is also the order the status dot cycles through. */
export const STATUS_ORDER: TaskStatus[] = ["not_started", "in_progress", "completed"];

export const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];

/** The next state in the cycle, wrapping back to the start. */
export function nextStatus(status: TaskStatus): TaskStatus {
  const index = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(index + 1) % STATUS_ORDER.length] ?? STATUS_ORDER[0]!;
}
