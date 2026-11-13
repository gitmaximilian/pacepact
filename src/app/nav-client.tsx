"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SECTIONS, sectionOf, type Section } from "@/lib/nav";
import { Icon } from "./icons";
import { markBusy } from "./instant";

const ICON = { crew: "crew", log: "plus", me: "user" } as const;

/**
 * Tab bar (phone) and top navigation (desktop). Lives in the shared layout, so it never re-renders
 * on navigation; the tapped tab lights up at once, before the next page has arrived.
 */
function useActive(): [Section | null, (s: Section) => void] {
  const path = usePathname();
  const [pending, setPending] = useState<Section | null>(null);
  useEffect(() => {
    setPending(null);
    markBusy(false);
  }, [path]);
  const tap = (s: Section) => {
    if (s !== sectionOf(path)) markBusy(true);
    setPending(s);
  };
  return [pending ?? sectionOf(path), tap];
}

export function TabBar({ labels }: { labels: Record<"crew" | "log" | "me", string> }) {
  const [active, tap] = useActive();
  return (
    <nav className="tabbar" aria-label="Main">
      {SECTIONS.map(({ section, href }) => (
        <Link key={section} href={href} aria-current={active === section ? "page" : undefined} onClick={() => tap(section)}>
          <span className="ind"><Icon name={ICON[section]} size={22} /></span>
          <span className="lbl">{labels[section]}</span>
        </Link>
      ))}
    </nav>
  );
}

export function TopNav({ labels }: { labels: Record<"crew" | "log" | "me" | "settings", string> }) {
  const [active, tap] = useActive();
  const items = [...SECTIONS, { section: "settings" as const, href: "/settings" }];
  return (
    <nav className="nav" aria-label="Main">
      {items.map(({ section, href }) => (
        <Link key={section} href={href} aria-current={active === section ? "page" : undefined} onClick={() => tap(section)}>
          {labels[section]}
        </Link>
      ))}
    </nav>
  );
}

export function GearLink({ label }: { label: string }) {
  const [active, tap] = useActive();
  return (
    <Link href="/settings" className="icon-btn mobile-only" aria-label={label} aria-current={active === "settings" ? "page" : undefined} onClick={() => tap("settings")}>
      <Icon name="gear" />
    </Link>
  );
}
