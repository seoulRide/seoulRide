export type EventStatus = "past" | "ongoing" | "upcoming";

/**
 * Canonical event sort: start date ASC, ties broken by end date ASC
 * (soonest-ending wins). Use everywhere we list events chronologically.
 */
export function compareEventsByStartThenEnd(
  a: { start: string; end: string },
  b: { start: string; end: string },
): number {
  const cs = a.start.localeCompare(b.start);
  if (cs !== 0) return cs;
  return (a.end || a.start).localeCompare(b.end || b.start);
}

/**
 * Robust parser for the datetime strings produced by our ingest pipeline.
 * Accepts "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss", and full ISO. Returns null
 * when input is empty or unparseable.
 */
export function parseEventDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Normalize " " separator to "T" so V8 reliably parses as local time.
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Classify an event as past/ongoing/upcoming relative to `now`.
 * - past: end date is before now
 * - upcoming: start date is after now
 * - ongoing: start <= now <= end (including single-day events whose date is today)
 *
 * Date-only inputs (no time) are treated as the entire local day so that an
 * event with end=2026-05-07 doesn't flip to "past" until midnight.
 */
export function getEventStatus(
  start: string | null | undefined,
  end: string | null | undefined,
  now: Date = new Date(),
): EventStatus {
  const s = parseEventDate(start);
  const rawEnd = parseEventDate(end);
  const eEnd = rawEnd ?? s;
  // Promote date-only inputs to end-of-day so a same-day event stays "ongoing"
  // until midnight regardless of zone fuzz.
  const isDateOnly = (x: string | null | undefined) => !!x && /^\d{4}-\d{2}-\d{2}$/.test(x.trim());
  const endBoundary = eEnd
    ? isDateOnly(end ?? "") || (rawEnd === null && isDateOnly(start ?? ""))
      ? new Date(eEnd.getFullYear(), eEnd.getMonth(), eEnd.getDate(), 23, 59, 59, 999)
      : eEnd
    : null;
  if (!s) return "upcoming"; // unknown start → bias to upcoming so we don't hide it
  if (endBoundary && endBoundary.getTime() < now.getTime()) return "past";
  if (s.getTime() > now.getTime()) return "upcoming";
  return "ongoing";
}
