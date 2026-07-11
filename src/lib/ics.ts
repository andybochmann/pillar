/**
 * Pure, dependency-free RFC 5545 (iCalendar) builder.
 *
 * All formatting and escaping lives here so it can be unit-tested without a
 * database or network. The feed route composes {@link IcsEvent}s from tasks and
 * calls {@link buildCalendar}; it does no string assembly of its own.
 *
 * Notes on the format:
 * - Line endings are CRLF (`\r\n`) as required by RFC 5545 §3.1.
 * - Text values are escaped via {@link escapeIcsText} to prevent ICS injection.
 * - Long content lines are folded at 75 octets via {@link foldLine}.
 * - Due dates are date-only (UTC midnight), so events are all-day
 *   (`VALUE=DATE`, `YYYYMMDD`) rather than timed.
 */

const CRLF = "\r\n";
const PRODID = "-//Pillar//Task Feed//EN";

export interface IcsEvent {
  /** Stable unique identifier, e.g. `<taskId>@pillar`. */
  uid: string;
  /** All-day date for the event (formatted as the local UTC calendar date). */
  start: Date;
  /** Event title (SUMMARY). */
  summary: string;
  /** Optional longer text (DESCRIPTION). */
  description?: string;
  /** Timestamp for DTSTAMP; defaults to `now` when omitted. */
  dtstamp?: Date;
}

/**
 * Escape a text value for use in an iCalendar property per RFC 5545 §3.3.11.
 *
 * Backslash MUST be escaped first so we don't double-escape the escapes we add
 * for the other characters. Order: `\` → `\\`, then `;` → `\;`, `,` → `\,`,
 * and CR/LF (in any combination) collapse to the literal two-character `\n`.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Two-digit zero-pad. */
function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Format a Date as an all-day iCalendar DATE value (`YYYYMMDD`).
 *
 * Uses UTC components because Pillar stores due dates as UTC-midnight
 * date-only values, so the UTC calendar date is the intended day.
 */
export function formatIcsDate(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}${m}${d}`;
}

/**
 * Format a Date as a UTC iCalendar DATE-TIME value (`YYYYMMDDTHHMMSSZ`).
 * Used for DTSTAMP.
 */
export function formatIcsDateTime(date: Date): string {
  return (
    `${formatIcsDate(date)}T` +
    `${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(
      date.getUTCSeconds(),
    )}Z`
  );
}

/** Add whole days to a date, returning a new Date (UTC-based). */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** UTF-8 byte length of a string (RFC 5545 folds on octets, not characters). */
function octetLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Fold a single content line to a maximum of 75 octets per RFC 5545 §3.1.
 *
 * Continuation lines are prefixed with a single space. Folding is done on
 * character boundaries while measuring octets, so multi-byte characters are
 * never split across a fold.
 */
export function foldLine(line: string): string {
  if (octetLength(line) <= 75) return line;

  const parts: string[] = [];
  let current = "";
  // First line budget is 75 octets; continuation lines reserve 1 octet for
  // the leading space, giving them a 74-octet budget for content.
  let isFirst = true;

  for (const char of line) {
    const limit = isFirst ? 75 : 74;
    if (octetLength(current + char) > limit) {
      parts.push(current);
      current = char;
      isFirst = false;
    } else {
      current += char;
    }
  }
  parts.push(current);

  return parts.map((p, i) => (i === 0 ? p : ` ${p}`)).join(CRLF);
}

/** Build one folded `NAME:VALUE` (or `NAME;PARAMS:VALUE`) content line. */
function contentLine(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function buildEvent(event: IcsEvent): string[] {
  const start = event.start;
  const end = addDays(start, 1); // DTEND is exclusive for all-day events.
  const lines = [
    "BEGIN:VEVENT",
    contentLine("UID", event.uid),
    contentLine("DTSTAMP", formatIcsDateTime(event.dtstamp ?? new Date())),
    contentLine("DTSTART;VALUE=DATE", formatIcsDate(start)),
    contentLine("DTEND;VALUE=DATE", formatIcsDate(end)),
    contentLine("SUMMARY", escapeIcsText(event.summary)),
  ];
  if (event.description) {
    lines.push(contentLine("DESCRIPTION", escapeIcsText(event.description)));
  }
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Build a complete VCALENDAR document from a list of events.
 *
 * Always emits a valid, non-empty calendar (BEGIN/END/VERSION/PRODID) even when
 * `events` is empty. Output is CRLF-terminated including a trailing CRLF.
 */
export function buildCalendar(events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    lines.push(...buildEvent(event));
  }
  lines.push("END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}
