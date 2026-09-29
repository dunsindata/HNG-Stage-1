import { TaskItem } from "./TaskItem";
import type { StatusFilter, Todo } from "../types";

interface TaskListProps {
  todos: Todo[];
  isLoading: boolean;
  status: StatusFilter;
  query: string;
  onToggle: (todo: Todo) => void;
  onRename: (id: number, title: string) => void;
  onRemove: (todo: Todo) => void;
}

function emptyMessage(status: StatusFilter, query: string, isLoading: boolean): string {
  if (isLoading) return "Loading tasks…";
  if (query) return `No tasks match “${query}”.`;
  if (status === "active") return "Nothing left to do.";
  if (status === "completed") return "No completed tasks yet.";
  return "No tasks yet — add your first one above.";
}

export function TaskList({
  todos,
  isLoading,
  status,
  query,
  onToggle,
  onRename,
  onRemove,
}: TaskListProps) {
  return (
    <>
      <ul className="tasks">
        {todos.map((todo) => (
          <TaskItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onRename={onRename}
            onRemove={onRemove}
          />
        ))}
      </ul>
      <p className="empty" hidden={todos.length > 0}>
        {emptyMessage(status, query, isLoading)}
      </p>
    </>
  );
}
