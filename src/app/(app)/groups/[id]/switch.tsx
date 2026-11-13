"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * The crew name is the switcher: a tap opens a small list of the runner's crews and one quiet
 * link to start or join another. Closes on a tap outside or Escape.
 */
export function CrewSwitch({ current, crews, labels }: { current: { id: string; name: string }; crews: { id: string; name: string }[]; labels: { switch: string; more: string } }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details ref={ref} className="crew-switch">
      <summary aria-label={labels.switch}>
        <h1>
          {current.name}
          <svg className="chev" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </h1>
      </summary>
      <div className="crew-menu" role="menu">
        {crews.map((c) => (
          <Link key={c.id} href={`/groups/${c.id}`} role="menuitem" aria-current={c.id === current.id ? "page" : undefined}>
            <span>{c.name}</span>
            {c.id === current.id ? <span aria-hidden="true">✓</span> : null}
          </Link>
        ))}
        <Link href="/groups?all=1" role="menuitem" className="more">＋ {labels.more}</Link>
      </div>
    </details>
  );
}

/** Remembers the crew on this device, so the Crew tab opens it next time (no database write). */
export function RememberCrew({ id }: { id: string }) {
  useEffect(() => {
    document.cookie = `pp_crew=${id}; path=/; max-age=31536000; samesite=lax`;
  }, [id]);
  return null;
}
