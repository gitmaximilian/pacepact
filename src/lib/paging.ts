/** How many items a list shows: a page size, grown by "show more" (?n=…), capped so a page never gets heavy. */
export function listSize(raw: string | null, step: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= step) return step;
  return Math.min(max, Math.ceil(n / step) * step);
}
