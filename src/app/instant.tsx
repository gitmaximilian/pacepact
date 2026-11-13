"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Links that react on tap: the tapped one is marked at once and the page content dims a little
 * until the server answers. Server-rendered pages otherwise show nothing until then.
 */
const Ctx = createContext<{ pending: string | null; tap: (href: string) => void } | null>(null);

function useUrlKey() {
  const path = usePathname();
  const sp = useSearchParams();
  return `${path}?${sp.toString()}`;
}

/** Dims the content column while a navigation is under way. */
export function markBusy(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.busy = "1";
  else delete document.documentElement.dataset.busy;
}

export function InstantGroup({ className, label, role, bare, children }: { className?: string; label?: string; role?: string; bare?: boolean; children: ReactNode }) {
  const [pending, setPending] = useState<string | null>(null);
  const url = useUrlKey();
  useEffect(() => {
    setPending(null);
    markBusy(false);
  }, [url]);
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => { setPending(null); markBusy(false); }, 8000);
    return () => window.clearTimeout(t);
  }, [pending]);
  return (
    <Ctx.Provider value={{ pending, tap: (href) => { setPending(href); markBusy(true); } }}>
      {bare ? children : <nav className={className} aria-label={label} role={role}>{children}</nav>}
    </Ctx.Provider>
  );
}

export function InstantLink({ href, active, className, activeClass, children, current = "page" }: { href: string; active: boolean; className?: string; activeClass?: string; children: ReactNode; current?: "page" | "true" }) {
  const g = useContext(Ctx);
  const on = g?.pending ? g.pending === href : active;
  return (
    <Link
      href={href}
      scroll={false}
      className={[className, on && activeClass ? activeClass : null, g?.pending === href ? "pending" : null].filter(Boolean).join(" ") || undefined}
      aria-current={on ? current : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || active) return;
        g?.tap(href);
      }}
    >
      {children}
    </Link>
  );
}
