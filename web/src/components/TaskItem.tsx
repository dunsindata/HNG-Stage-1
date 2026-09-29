import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { describeDue } from "../lib/dates";
import type { Todo } from "../types";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

interface TaskItemProps {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onRename: (id: number, title: string) => void;
  onRemove: (todo: Todo) => void;
}

export function TaskItem({ todo, onToggle, onRename, onRemove }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const editorRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      editorRef.current?.focus();
      editorRef.current?.select();
    }
  }, [isEditing]);

  function startEditing() {
    cancelledRef.current = false;
    setDraft(todo.title);
    setIsEditing(true);
  }

  function commit() {
    // Escape sets the flag first, so the blur that follows cannot save it.
    if (cancelledRef.current) return;
    const next = draft.trim();
    setIsEditing(false);
    if (next && next !== todo.title) onRename(todo.id, next);
  }

  function cancel() {
    cancelledRef.current = true;
    setIsEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  const due = todo.due_date ? describeDue(todo.due_date) : null;
  const dueClassName = `badge badge--due${due && due.overdue && !todo.completed ? " is-overdue" : ""}`;

  return (
    <li className={todo.completed ? "task is-completed" : "task"}>
      <input
        className="task__toggle"
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo)}
        aria-label={
          todo.completed ? `Mark "${todo.title}" as active` : `Mark "${todo.title}" as complete`
        }
      />
      <div className="task__body">
        {isEditing ? (
          <input
            ref={editorRef}
            className="task__editor"
            type="text"
            maxLength={200}
            aria-label="Edit task title"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <p className="task__title">{todo.title}</p>
        )}
        <div className="task__meta">
          <span className="badge badge--priority" data-priority={todo.priority}>
            {PRIORITY_LABELS[todo.priority] ?? todo.priority}
          </span>
          {due ? <span className={dueClassName}>{due.text}</span> : null}
        </div>
      </div>
      <div className="task__actions">
        <button
          type="button"
          className="icon-button"
          onClick={startEditing}
          disabled={isEditing}
        >
          Edit
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={() => onRemove(todo)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
