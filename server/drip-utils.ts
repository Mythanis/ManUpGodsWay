export function getNextMidnightInTimezone(completedAt: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const getParts = (d: Date) => {
      const parts = formatter.formatToParts(d);
      const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
      return { year: get('year'), month: get('month'), day: get('day') };
    };

    const { year, month, day } = getParts(completedAt);
    const now = new Date();
    const nowParts = getParts(now);

    const nextDay = new Date(year, month - 1, day + 1);
    const nowDate = new Date(nowParts.year, nowParts.month - 1, nowParts.day);

    if (nowDate >= nextDay) {
      return new Date(0);
    }

    const nowFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const nowTimeParts = nowFormatter.formatToParts(now);
    const getT = (type: string) => parseInt(nowTimeParts.find(p => p.type === type)?.value || '0');
    const secondsPassedToday = getT('hour') * 3600 + getT('minute') * 60 + getT('second');
    const secondsUntilMidnight = 86400 - secondsPassedToday;

    return new Date(now.getTime() + secondsUntilMidnight * 1000);
  } catch {
    return new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
  }
}
