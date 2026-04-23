// Timezone helpers for day-rollover-sensitive logic (devotionals, streaks).
// We deliberately avoid changing the container's TZ env var so this stays
// explicit and intentional at each call site.

export const DEFAULT_TIMEZONE = 'America/Chicago';

// Returns the date components ({year, month, day}) for a Date in a given IANA timezone.
function getYmdParts(date: Date, timezone: string): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// Returns "YYYY-MM-DD" for a Date as observed in the given IANA timezone.
export function getDateStringInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const { year, month, day } = getYmdParts(date, timezone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Offset in minutes for a given timezone at a given instant.
// e.g. for America/Chicago in summer (CDT) => -300.
function getTimezoneOffsetMinutes(timezone: string, at: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });
  const tzName = fmt.formatToParts(at).find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00';
  const m = tzName.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === '+' ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

// Returns the UTC Date instant equal to 00:00:00 (local time) for the given
// YYYY-MM-DD in the given timezone. DST-safe: the offset is resolved at the
// candidate midnight, so spring-forward / fall-back days compute correctly.
export function getStartOfDayForYmdInTimezone(ymd: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const utcMidnight = new Date(`${ymd}T00:00:00Z`);
  const offsetMin = getTimezoneOffsetMinutes(timezone, utcMidnight);
  return new Date(utcMidnight.getTime() - offsetMin * 60 * 1000);
}

// Returns a UTC Date instant equal to 00:00:00 of "today" in the given timezone.
// e.g. at any moment on 2026-04-23 in America/Chicago (CDT, -05:00),
// returns the Date for 2026-04-23T05:00:00Z.
export function getStartOfDayInTimezone(timezone: string = DEFAULT_TIMEZONE, ref: Date = new Date()): Date {
  return getStartOfDayForYmdInTimezone(getDateStringInTimezone(ref, timezone), timezone);
}

// Returns a Date representing midnight UTC for the given YYYY-MM-DD.
// Use this when the DB column stores dates as "date labels" at UTC midnight
// (e.g. devotionals.date created via `new Date('2026-04-23T00:00:00Z')`),
// rather than as actual local-midnight instants.
export function getYmdAsUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

// DST-safe calendar-day arithmetic on a YYYY-MM-DD string.
// Adds `days` (can be negative) and returns the resulting YYYY-MM-DD.
export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  // UTC math used purely for calendar arithmetic — no DST involved here.
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Returns the UTC Date instant equal to 00:00:00 of the day AFTER "today" in
// the given timezone. DST-safe — uses calendar-day arithmetic, not +24h.
export function getStartOfNextDayInTimezone(timezone: string = DEFAULT_TIMEZONE, ref: Date = new Date()): Date {
  const todayYmd = getDateStringInTimezone(ref, timezone);
  return getStartOfDayForYmdInTimezone(addDaysToYmd(todayYmd, 1), timezone);
}
