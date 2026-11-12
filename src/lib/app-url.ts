/** Public base URL of the app (wrangler.jsonc "vars"; localhost in development). */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
