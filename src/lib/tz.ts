/** Wall-clock date and time in an IANA time zone → absolute Date (handles summer time). */
export function zonedDate(date: string, time: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  let tz = "Europe/Vienna";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    tz = timeZone;
  } catch {
    // unknown zone: keep the default
  }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  // The zone's offset at a given instant, in minutes.
  const offsetAt = (instant: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(instant))
        .map((x) => [x.type, x.value]),
    );
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - instant) / 60_000;
  };
  let guess = wall - offsetAt(wall) * 60_000;
  guess = wall - offsetAt(guess) * 60_000;
  const d = new Date(guess);
  return Number.isNaN(d.getTime()) ? null : d;
}
