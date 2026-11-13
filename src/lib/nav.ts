/** The three places of the app and which one a path belongs to. Pure, so the tab bar can light up instantly. */
export type Section = "crew" | "log" | "me" | "settings";

export const SECTIONS: { section: Exclude<Section, "settings">; href: string }[] = [
  { section: "crew", href: "/groups" },
  { section: "log", href: "/runs/new" },
  { section: "me", href: "/dashboard" },
];

export function sectionOf(path: string): Section | null {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const under = (base: string) => p === base || p.startsWith(`${base}/`);
  if (under("/runs/new") || under("/import")) return "log";
  if (under("/groups") || under("/rules")) return "crew";
  if (under("/dashboard") || under("/runs") || under("/plan") || under("/goal") || under("/challenges")) return "me";
  if (under("/settings")) return "settings";
  return null;
}
