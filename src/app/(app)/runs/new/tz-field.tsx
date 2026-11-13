"use client";

/** Sends the device's time zone, so the run time is stored as the local time the runner typed. */
export function TzField() {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  return <input type="hidden" name="tz" value={tz} suppressHydrationWarning />;
}
