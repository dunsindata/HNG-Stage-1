/** Due-date presentation helpers. `today` is injectable so they stay testable. */

const DAY_MS = 24 * 60 * 60 * 1000;

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
