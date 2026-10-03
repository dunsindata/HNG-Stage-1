import { describeDue, formatNumericDate } from "../lib/dates";
import { PRIORITY_LABELS, STATUS_LABELS, nextStatus } from "../lib/labels";
import type { TaskStatus, Todo } from "../types";
import { IconTrash } from "./Icons";

interface TaskCardProps {
  todo: Todo;
  onAdvanceStatus: (todo: Todo, status: TaskStatus) => void;
  onRemove: (todo: Todo) => void;
}

export function TaskCard({ todo, onAdvanceStatus, onRemove }: TaskCardProps) {
  const due = todo.due_date ? describeDue(todo.due_date) : null;
  const isDone = todo.status === "completed";
  const upcoming = STATUS_LABELS[nextStatus(todo.status)];

  return (
    <article className={`task-card${isDone ? " task-card--done" : ""}`}>
      <button
        type="button"
        className={`status-dot status-dot--${todo.status}`}
        aria-label={`Mark "${todo.title}" as ${upcoming}`}
        title={`Mark as ${upcoming}`}
        onClick={() => onAdvanceStatus(todo, nextStatus(todo.status))}
      />

      <div className="task-card__body">
        <h3 className="task-card__title">{todo.title}</h3>
        {todo.description ? <p className="task-card__description">{todo.description}</p> : null}

        <p className="task-card__meta">
          <span>
            Priority:{" "}
            <strong className={`text--priority-${todo.priority}`}>{PRIORITY_LABELS[todo.priority]}</strong>
          </span>
          <span className="meta-sep" aria-hidden="true">
            |
          </span>
          <span>
            Status:{" "}
            <strong className={`text--status-${todo.status}`}>{STATUS_LABELS[todo.status]}</strong>
          </span>
          <span className="meta-sep" aria-hidden="true">
            |
          </span>
          <span>Created on: {formatNumericDate(todo.created_at)}</span>
        </p>

        {due ? (
          <p className={`task-card__due${due.overdue && !isDone ? " is-overdue" : ""}`}>{due.text}</p>
        ) : null}
      </div>

      <div className="task-card__side">
        {todo.image ? (
          <img className="task-card__thumb" src={todo.image} alt="" loading="lazy" />
        ) : null}
        <button
          type="button"
          className="icon-button--ghost"
          aria-label={`Delete ${todo.title}`}
          onClick={() => onRemove(todo)}
        >
          <IconTrash />
        </button>
      </div>
    </article>
  );
}
