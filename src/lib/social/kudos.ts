/** Kudos counts of one feed item, and how a tap changes them. Pure, so the tap can show at once. */
export interface KudoState {
  /** Per emoji: how many people gave it and whether the viewer is one of them. */
  [emoji: string]: { n: number; mine: boolean };
}

export function toggleKudo(state: KudoState, emoji: string): KudoState {
  const cur = state[emoji] ?? { n: 0, mine: false };
  return { ...state, [emoji]: cur.mine ? { n: Math.max(0, cur.n - 1), mine: false } : { n: cur.n + 1, mine: true } };
}

export function kudoState(emojis: readonly string[], reactions: { emoji: string; userId: string }[], me: string): KudoState {
  const out: KudoState = {};
  for (const e of emojis) {
    const who = reactions.filter((r) => r.emoji === e);
    out[e] = { n: who.length, mine: who.some((r) => r.userId === me) };
  }
  return out;
}
