import { formatNumericToday, weekdayName } from "../lib/dates";
import { IconApps, IconBell, IconSearch } from "./Icons";

interface TopbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  today?: Date;
}

export function Topbar({ query, onQueryChange, today = new Date() }: TopbarProps) {
  return (
    <header className="topbar">
      <p className="brand">
        <span className="brand__accent">Dash</span>
        <span className="brand__rest">board</span>
      </p>

      <form
        className="topbar__search"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <input
          className="topbar__search-input"
          type="search"
          maxLength={200}
          placeholder="Search your task here..."
          aria-label="Search your task here"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <button type="submit" className="icon-button--coral" aria-label="Search">
          <IconSearch />
        </button>
      </form>

      <div className="topbar__actions">
        <button type="button" className="icon-button--coral" aria-label="Notifications">
          <IconBell />
        </button>
        <button type="button" className="icon-button--coral" aria-label="Open apps">
          <IconApps />
        </button>
      </div>

      <p className="topbar__date">
        <span className="topbar__weekday">{weekdayName(today)}</span>
        <span className="topbar__day">{formatNumericToday(today)}</span>
      </p>
    </header>
  );
}
