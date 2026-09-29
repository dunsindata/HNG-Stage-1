import { describe, expect, it } from "vitest";

import { describeDue, formatShortDate, parseIsoDate } from "./dates";

const TODAY = new Date(2031, 0, 15, 13, 30); // 15 January 2031, local time

describe("parseIsoDate", () => {
  it("reads YYYY-MM-DD as a local calendar date", () => {
    const date = parseIsoDate("2031-03-04");

    expect(date.getFullYear()).toBe(2031);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(4);
    expect(date.getHours()).toBe(0);
  });
});

describe("describeDue", () => {
  it("labels today, tomorrow and yesterday", () => {
    expect(describeDue("2031-01-15", TODAY).text).toBe("Due today");
    expect(describeDue("2031-01-16", TODAY).text).toBe("Due tomorrow");
    expect(describeDue("2031-01-14", TODAY).text).toBe("Due yesterday");
  });

  it("treats yesterday as overdue", () => {
    expect(describeDue("2031-01-14", TODAY).overdue).toBe(true);
  });

  it("marks earlier dates as overdue and mentions the date", () => {
    const due = describeDue("2031-01-02", TODAY);

    expect(due.overdue).toBe(true);
    expect(due.text.startsWith("Overdue")).toBe(true);
  });

  it("does not mark today or the future as overdue", () => {
    expect(describeDue("2031-01-15", TODAY).overdue).toBe(false);
    expect(describeDue("2031-02-20", TODAY).overdue).toBe(false);
  });

  it("counts across a month boundary", () => {
    expect(describeDue("2031-03-01", TODAY).text).toBe("Due Mar 1");
    expect(describeDue("2031-02-28", TODAY).overdue).toBe(false);
  });
});

describe("formatShortDate", () => {
  it("differs between a same-year and a different-year date", () => {
    const sameYear = formatShortDate(new Date(2031, 5, 4), TODAY);
    const otherYear = formatShortDate(new Date(2032, 0, 4), TODAY);

    expect(sameYear).not.toBe(otherYear);
  });
});
