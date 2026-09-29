import type { Stats, StatusFilter } from "../types";

const FILTERS: { status: StatusFilter; label: string; count: keyof Stats }[] = [
  { status: "all", label: "All", count: "total" },
  { status: "active", label: "Active", count: "active" },
  { status: "completed", label: "Completed", count: "completed" },
];

interface ToolbarProps {
  status: StatusFilter;
  stats: Stats;
  query: string;
  onStatusChange: (status: StatusFilter) => void;
  onQueryChange: (query: string) => void;
}

export function Toolbar({
  status,
  stats,
  query,
  onStatusChange,
  onQueryChange,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="filters" role="group" aria-label="Filter tasks">
        {FILTERS.map((filter) => (
          <button
            key={filter.status}
            type="button"
            className="filter"
            aria-pressed={filter.status === status}
            onClick={() => onStatusChange(filter.status)}
          >
            {filter.label} <span className="filter__count">{stats[filter.count]}</span>
          </button>
        ))}
      </div>
      <input
        className="search"
        type="search"
        maxLength={200}
        placeholder="Search tasks"
        aria-label="Search tasks"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </div>
  );
}
