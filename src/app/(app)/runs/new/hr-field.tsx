"use client";

import { useState } from "react";

export interface HrLabels {
  avgHr: string;
  optional: string;
  private: string;
  consentTitle: string;
  consentText: string;
}

/**
 * Average heart rate as a standard field. Without stored consent the runner can give it right
 * here: a separate, unticked checkbox with the full consent text (Art. 9(2)(a) GDPR). The field
 * only appears once it is ticked, so no heart rate is sent without consent.
 */
export function HrField({ consented, labels: l }: { consented: boolean; labels: HrLabels }) {
  const [on, setOn] = useState(consented);
  return (
    <div className="field hr-field">
      {consented ? null : (
        <label className="check hr-consent">
          <input type="checkbox" name="hrConsent" checked={on} onChange={(e) => setOn(e.target.checked)} />
          <span>
            <b>❤️ {l.consentTitle}</b>
            <span className="small muted">{l.consentText}</span>
          </span>
        </label>
      )}
      {on ? (
        <>
          <label htmlFor="avgHr">{l.avgHr} <span className="muted">({l.optional})</span></label>
          <input id="avgHr" name="avgHr" type="number" min={25} max={250} inputMode="numeric" placeholder="148" className="big-input" />
          <span className="hint">{l.private}</span>
        </>
      ) : null}
    </div>
  );
}
