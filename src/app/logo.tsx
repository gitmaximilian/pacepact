/** Two interlocking track ovals: you and your group. `tile` draws the blue app-icon square. */
export function Logo({ size = 32, mono = false, tile = false }: { size?: number; mono?: boolean; tile?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {tile ? <rect width="64" height="64" rx="14" fill="#1D4FA8" /> : null}
      <rect x="5" y="17" width="34" height="30" rx="15" fill="none" stroke={mono ? "currentColor" : "#FFFFFF"} strokeWidth="6" />
      <rect x="25" y="17" width="34" height="30" rx="15" fill="none" stroke="#FFD23F" strokeWidth="6" />
    </svg>
  );
}
