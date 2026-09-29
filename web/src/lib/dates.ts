/** Date presentation helpers. `today` is injectable so they stay testable. */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export interface DueDescription {
  text: string;
  overdue: boolean;
}

/** Parse `YYYY-MM-DD` as a *local* date, matching the server's calendar day. */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatShortDate(date: Date, today: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === today.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString(undefined, options);
}

/**
 * `21/8/2023` — the numeric style the board's "Created on" line uses.
 * Takes a full timestamp (the server stores ISO-8601 UTC) and shows the
 * reader's local calendar day.
 */
export function formatNumericDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

/** `20/06/2023` — the top bar's date. */
export function formatNumericToday(date: Date = new Date()): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

/** `20 June` — the date strip in a panel header. */
export function formatDayMonth(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

export function weekdayName(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

/** "just now", "3 hours ago", "2 days ago" — for "Completed 2 days ago". */
export function relativePast(iso: string, today: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const elapsed = today.getTime() - then.getTime();
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(elapsed / DAY_MS);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function describeDue(iso: string, today: Date = new Date()): DueDescription {
  const due = parseIsoDate(iso);
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - startOfToday.getTime()) / DAY_MS);

  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  if (days === -1) return { text: "Due yesterday", overdue: true };
  if (days < 0) return { text: `Overdue · ${formatShortDate(due, today)}`, overdue: true };
  return { text: `Due ${formatShortDate(due, today)}`, overdue: false };
}
