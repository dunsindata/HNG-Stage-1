import { relativePast } from "../lib/dates";
import type { Todo } from "../types";
import { IconCheck } from "./Icons";

interface CompletedPanelProps {
  todos: Todo[];
}

export function CompletedPanel({ todos }: CompletedPanelProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <h2 className="panel__title">Completed Task</h2>
      </header>

      {todos.length === 0 ? (
        <p className="panel__empty">Nothing completed yet.</p>
      ) : (
        <ul className="done-list">
          {todos.map((todo) => (
            <li key={todo.id} className="done-item">
              <span className="done-item__check" aria-hidden="true">
                <IconCheck />
              </span>
              <div className="done-item__body">
                <p className="done-item__title">{todo.title}</p>
                {todo.description ? (
                  <p className="done-item__description">{todo.description}</p>
                ) : null}
                <p className="done-item__meta">
                  {todo.completed_at ? `Completed ${relativePast(todo.completed_at)}` : "Completed"}
                </p>
              </div>
              {todo.image ? (
                <img className="done-item__thumb" src={todo.image} alt="" loading="lazy" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
