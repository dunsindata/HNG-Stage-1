import { describe, expect, it } from "vitest";

import {
  describeDue,
  formatDayMonth,
  formatNumericDate,
  formatNumericToday,
  formatShortDate,
  parseIsoDate,
  relativePast,
  weekdayName,
} from "./dates";

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

describe("formatNumericDate", () => {
  it("writes day/month/year without padding, as the board does", () => {
    // No zone suffix: JavaScript reads that as local time, so the day is stable.
    expect(formatNumericDate("2031-04-05T12:00:00")).toBe("5/4/2031");
    expect(formatNumericDate("2031-12-31T12:00:00")).toBe("31/12/2031");
  });

  it("shows the local day of a UTC timestamp", () => {
    expect(formatNumericDate("2031-04-05T23:30:00Z")).toBe(
      new Date("2031-04-05T23:30:00Z").getDate() + "/" +
        (new Date("2031-04-05T23:30:00Z").getMonth() + 1) +
        "/2031",
    );
  });

  it("returns an empty string for an unparseable stamp", () => {
    expect(formatNumericDate("not-a-date")).toBe("");
  });
});

describe("formatNumericToday and weekdayName", () => {
  it("formats the top bar's date", () => {
    expect(formatNumericToday(TODAY)).toBe("15/1/2031");
  });

  it("names the weekday", () => {
    expect(weekdayName(TODAY)).toBe(TODAY.toLocaleDateString(undefined, { weekday: "long" }));
  });

  it("includes the month name in the panel strip", () => {
    expect(formatDayMonth(TODAY)).toContain("January");
  });
});

describe("relativePast", () => {
  it("describes recent moments", () => {
    // Both stamps are UTC so the result does not depend on the machine's zone.
    const now = new Date("2031-01-15T12:00:00Z");
    expect(relativePast("2031-01-15T11:59:30Z", now)).toBe("just now");
    expect(relativePast("2031-01-15T11:15:00Z", now)).toBe("45 minutes ago");
    expect(relativePast("2031-01-15T09:00:00Z", now)).toBe("3 hours ago");
  });

  it("uses singular and plural days", () => {
    const now = new Date("2031-01-15T12:00:00Z");
    expect(relativePast("2031-01-14T12:00:00Z", now)).toBe("1 day ago");
    expect(relativePast("2031-01-12T12:00:00Z", now)).toBe("3 days ago");
  });

  it("returns an empty string for an unparseable stamp", () => {
    expect(relativePast("not-a-date", TODAY)).toBe("");
  });
});
