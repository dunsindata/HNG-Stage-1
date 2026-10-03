import { formatDayMonth } from "../lib/dates";
import type { TaskStatus, Todo } from "../types";
import { IconPlus } from "./Icons";
import { TaskCard } from "./TaskCard";

interface TodoBoardProps {
  title: string;
  todos: Todo[];
  isLoading: boolean;
  completedCount: number;
  emptyHint: string;
  onAdd: () => void;
  onAdvanceStatus: (todo: Todo, status: TaskStatus) => void;
  onRemove: (todo: Todo) => void;
  onClearCompleted: () => void;
  today?: Date;
}

export function TodoBoard({
  title,
  todos,
  isLoading,
  completedCount,
  emptyHint,
  onAdd,
  onAdvanceStatus,
  onRemove,
  onClearCompleted,
  today = new Date(),
}: TodoBoardProps) {
  return (
    <section className="panel panel--board">
      <header className="panel__header">
        <div>
          <h2 className="panel__title">{title}</h2>
          <p className="panel__meta">
            {formatDayMonth(today)} <span className="panel__meta-divider">|</span> Today
          </p>
        </div>
        <button type="button" className="button--coral" onClick={onAdd}>
          <IconPlus />
          Add Task
        </button>
      </header>

      {todos.length > 0 ? (
        <ul className="task-list">
          {todos.map((todo) => (
            <li key={todo.id}>
              <TaskCard
                todo={todo}
                onAdvanceStatus={onAdvanceStatus}
                onRemove={onRemove}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="panel__empty">{isLoading ? "Loading tasks…" : emptyHint}</p>
      )}

      {completedCount > 0 ? (
        <footer className="panel__footer">
          <button type="button" className="link-button" onClick={onClearCompleted}>
            Clear {completedCount} completed task{completedCount === 1 ? "" : "s"}
          </button>
        </footer>
      ) : null}
    </section>
  );
}
