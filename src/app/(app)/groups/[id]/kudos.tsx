"use client";

import { useOptimistic } from "react";
import { toggleKudo, type KudoState } from "@/lib/social/kudos";
import { toggleReaction } from "@/app/(app)/groups/actions";

/**
 * One small form per feed item; the tapped emoji counts up at once (optimistic) while the
 * server stores it. Each button submits its own emoji.
 */
export function KudosBar({ base, state, emojis, labels, who }: { base: { groupId: string; targetType: string; targetId: string }; state: KudoState; emojis: { key: string; icon: string }[]; labels: Record<string, string>; who: Record<string, string> }) {
  const [opt, apply] = useOptimistic(state, toggleKudo);
  return (
    <form
      className="kudos"
      action={async (fd) => {
        apply(String(fd.get("emoji")));
        await toggleReaction(fd);
      }}
    >
      <input type="hidden" name="groupId" value={base.groupId} />
      <input type="hidden" name="targetType" value={base.targetType} />
      <input type="hidden" name="targetId" value={base.targetId} />
      {emojis.map(({ key, icon }) => {
        const k = opt[key] ?? { n: 0, mine: false };
        return (
          <button key={key} name="emoji" value={key} className={`kudo${k.mine ? " on" : ""}`} aria-pressed={k.mine} title={who[key] ? `${labels[key]}: ${who[key]}` : labels[key]}>
            <span aria-hidden="true">{icon}</span>
            {k.n ? <span className="n">{k.n}</span> : <span className="sr-only">{labels[key]}</span>}
          </button>
        );
      })}
    </form>
  );
}
