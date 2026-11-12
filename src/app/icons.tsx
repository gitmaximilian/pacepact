/** Small stroke icons (24×24), drawn inline: no icon font, no external requests. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function Icon({ name, size = 22 }: { name: "crew" | "today" | "plus" | "runs" | "plan" | "gear" | "share" | "trophy" | "flag"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...P}>
      {name === "crew" && (<><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M2.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><path d="M14 14.4c.8-.3 1.6-.4 2.5-.4 2.4 0 4.3 1.5 5 4.6" /></>)}
      {name === "today" && (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)}
      {name === "plus" && (<><path d="M12 5v14M5 12h14" /></>)}
      {name === "runs" && (<><path d="M4 6h16M4 12h16M4 18h10" /></>)}
      {name === "plan" && (<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>)}
      {name === "gear" && (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>)}
      {name === "share" && (<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>)}
      {name === "trophy" && (<><path d="M8 4h8v5a4 4 0 0 1-8 0V4z" /><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9.5 17h5" /></>)}
      {name === "flag" && (<><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>)}
    </svg>
  );
}
