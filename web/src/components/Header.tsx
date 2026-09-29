import type { Stats } from "../types";

interface HeaderProps {
  stats: Stats;
  onClearCompleted: () => void;
}

export function Header({ stats, onClearCompleted }: HeaderProps) {
  const summary =
    stats.total === 0
      ? "No tasks yet."
      : `${stats.active} active · ${stats.completed} completed · ${stats.total} total`;

  return (
    <header className="app__header">
      <div>
        <h1 className="app__title">Tasks</h1>
        <p className="app__summary" aria-live="polite">
          {summary}
        </p>
      </div>
      <button
        type="button"
        className="ghost-button"
        onClick={onClearCompleted}
        disabled={stats.completed === 0}
      >
        Clear completed
      </button>
    </header>
  );
}
