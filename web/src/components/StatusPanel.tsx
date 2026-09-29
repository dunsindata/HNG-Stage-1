import { formatDayMonth } from "../lib/dates";
import type { Stats } from "../types";
import { StatusDonut } from "./StatusDonut";

interface StatusPanelProps {
  stats: Stats;
  today?: Date;
}

export function StatusPanel({ stats, today = new Date() }: StatusPanelProps) {
  const total = stats.total;

  return (
    <section className="panel">
      <header className="panel__header">
        <h2 className="panel__title">Task Status</h2>
        <p className="panel__meta">
          {formatDayMonth(today)} <span className="panel__meta-divider">|</span> Today
        </p>
      </header>

      <div className="donuts">
        <StatusDonut label="Completed" value={stats.completed} total={total} color="var(--green)" />
        <StatusDonut label="In Progress" value={stats.in_progress} total={total} color="var(--blue)" />
        <StatusDonut label="Not Started" value={stats.not_started} total={total} color="var(--red)" />
      </div>

      <ul className="legend">
        <li className="legend__item">
          <span className="legend__dot" style={{ background: "var(--green)" }} aria-hidden="true" />
          Completed
        </li>
        <li className="legend__item">
          <span className="legend__dot" style={{ background: "var(--blue)" }} aria-hidden="true" />
          In Progress
        </li>
        <li className="legend__item">
          <span className="legend__dot" style={{ background: "var(--red)" }} aria-hidden="true" />
          Not Started
        </li>
      </ul>
    </section>
  );
}
