import { describe, it, expect } from "vitest";
import {
  escapeIcsText,
  formatIcsDate,
  formatIcsDateTime,
  foldLine,
  buildCalendar,
  type IcsEvent,
} from "./ics";

describe("escapeIcsText", () => {
  it("escapes backslashes first (no double-escaping)", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
  });

  it("escapes semicolons", () => {
    expect(escapeIcsText("a;b")).toBe("a\\;b");
  });

  it("escapes commas", () => {
    expect(escapeIcsText("a,b")).toBe("a\\,b");
  });

  it("escapes newlines to literal \\n", () => {
    expect(escapeIcsText("a\nb")).toBe("a\\nb");
    expect(escapeIcsText("a\r\nb")).toBe("a\\nb");
    expect(escapeIcsText("a\rb")).toBe("a\\nb");
  });

  it("escapes a combination of special characters in the correct order", () => {
    expect(escapeIcsText("Meet, greet; plan\\do\nnext")).toBe(
      "Meet\\, greet\\; plan\\\\do\\nnext",
    );
  });

  it("leaves plain text unchanged", () => {
    expect(escapeIcsText("Just a title")).toBe("Just a title");
  });

  it("prevents ICS injection via forged property lines", () => {
    // A malicious title trying to break out into a new property/event.
    const evil = "Task\nBEGIN:VEVENT\nSUMMARY:injected";
    const escaped = escapeIcsText(evil);
    expect(escaped).not.toContain("\n");
    expect(escaped).toBe("Task\\nBEGIN:VEVENT\\nSUMMARY:injected");
  });
});

describe("formatIcsDate", () => {
  it("formats a UTC-midnight date as YYYYMMDD", () => {
    expect(formatIcsDate(new Date("2026-07-11T00:00:00.000Z"))).toBe(
      "20260711",
    );
  });

  it("zero-pads month and day", () => {
    expect(formatIcsDate(new Date("2026-01-05T00:00:00.000Z"))).toBe(
      "20260105",
    );
  });

  it("uses UTC components, not local time", () => {
    // A time near end of UTC day still resolves to that UTC calendar date.
    expect(formatIcsDate(new Date("2026-03-09T23:59:59.000Z"))).toBe(
      "20260309",
    );
  });
});

describe("formatIcsDateTime", () => {
  it("formats a UTC date-time as YYYYMMDDTHHMMSSZ", () => {
    expect(formatIcsDateTime(new Date("2026-07-11T13:04:05.000Z"))).toBe(
      "20260711T130405Z",
    );
  });
});

describe("foldLine", () => {
  it("leaves short lines unchanged", () => {
    expect(foldLine("SUMMARY:Hi")).toBe("SUMMARY:Hi");
  });

  it("folds lines longer than 75 octets with a leading space on continuation", () => {
    const long = "DESCRIPTION:" + "x".repeat(200);
    const folded = foldLine(long);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    // First physical line is at most 75 octets.
    expect(Buffer.byteLength(physical[0], "utf8")).toBeLessThanOrEqual(75);
    // Continuation lines start with a single space.
    for (let i = 1; i < physical.length; i++) {
      expect(physical[i].startsWith(" ")).toBe(true);
      expect(Buffer.byteLength(physical[i], "utf8")).toBeLessThanOrEqual(75);
    }
    // Unfolding (strip CRLF + leading space) restores the original content.
    const unfolded = physical
      .map((l, i) => (i === 0 ? l : l.slice(1)))
      .join("");
    expect(unfolded).toBe(long);
  });
});

function unfold(ics: string): string {
  // Reverse RFC 5545 line folding: CRLF followed by a single space.
  return ics.replace(/\r\n /g, "");
}

describe("buildCalendar", () => {
  const event: IcsEvent = {
    uid: "abc123@pillar",
    start: new Date("2026-07-11T00:00:00.000Z"),
    summary: "Ship the feature",
    dtstamp: new Date("2026-07-01T09:00:00.000Z"),
  };

  it("produces a valid, well-formed VCALENDAR wrapper", () => {
    const ics = buildCalendar([event]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Pillar//Task Feed//EN");
  });

  it("uses CRLF line endings and a trailing CRLF", () => {
    const ics = buildCalendar([event]);
    expect(ics.endsWith("\r\n")).toBe(true);
    // No lone LF that isn't preceded by CR.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("emits a VEVENT with UID, all-day DTSTART/DTEND, SUMMARY and DTSTAMP", () => {
    const ics = buildCalendar([event]);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:abc123@pillar");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260711");
    // DTEND is exclusive → next day.
    expect(ics).toContain("DTEND;VALUE=DATE:20260712");
    expect(ics).toContain("SUMMARY:Ship the feature");
    expect(ics).toContain("DTSTAMP:20260701T090000Z");
  });

  it("includes DESCRIPTION only when provided", () => {
    const withDesc = buildCalendar([{ ...event, description: "Details" }]);
    expect(withDesc).toContain("DESCRIPTION:Details");
    const without = buildCalendar([event]);
    expect(without).not.toContain("DESCRIPTION:");
  });

  it("escapes special characters in SUMMARY within the document", () => {
    const ics = buildCalendar([{ ...event, summary: "A, B; C\\D\nE" }]);
    expect(ics).toContain("SUMMARY:A\\, B\\; C\\\\D\\nE");
  });

  it("does not allow injection to create extra property lines", () => {
    const ics = buildCalendar([
      { ...event, summary: "x\nDTSTART;VALUE=DATE:19700101" },
    ]);
    // The injected newline is neutralised, so it stays inside the SUMMARY
    // value: exactly one *physical line* begins with DTSTART (the real one).
    const dtstartLines = unfold(ics)
      .split("\r\n")
      .filter((l) => l.startsWith("DTSTART"));
    expect(dtstartLines.length).toBe(1);
    expect(ics).toContain("SUMMARY:x\\nDTSTART\\;VALUE=DATE:19700101");
  });

  it("produces a valid empty calendar when there are no events", () => {
    const ics = buildCalendar([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("emits one VEVENT per event", () => {
    const ics = buildCalendar([
      { ...event, uid: "1@pillar" },
      { ...event, uid: "2@pillar" },
    ]);
    const begins = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(begins.length).toBe(2);
  });

  it("folds a long escaped SUMMARY so no physical line exceeds 75 octets", () => {
    const ics = buildCalendar([{ ...event, summary: "y".repeat(200) }]);
    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    // The full summary survives once folding is reversed.
    expect(unfold(ics)).toContain("SUMMARY:" + "y".repeat(200));
  });
});
