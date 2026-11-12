"use client";

import { useState } from "react";
import { formatPace, paceSecPerKm, parseDuration } from "@/lib/pace";

interface Props {
  presets: { value: string; label: string }[];
  labels: { distance: string; custom: string; target: string; optional: string; pace: string };
  initialPreset: string;
  initialCustom: string;
  initialTarget: string;
}

/** Distance + target time inputs with a live "required pace" readout. */
export function PaceCalc({ presets, labels, initialPreset, initialCustom, initialTarget }: Props) {
  const [preset, setPreset] = useState(initialPreset);
  const [custom, setCustom] = useState(initialCustom);
  const [target, setTarget] = useState(initialTarget);
  const km = preset === "custom" ? Number(custom.replace(",", ".")) : Number(preset);
  const sec = target ? parseDuration(target) : null;
  const pace = sec ? paceSecPerKm(sec, km) : null;
  return (
    <div className="fields">
      <fieldset className="field type-pick" style={{ gridColumn: "1 / -1" }}>
        <legend>{labels.distance}</legend>
        <div className="seg">
          {[...presets, { value: "custom", label: labels.custom }].map((p) => (
            <label key={p.value}>
              <input type="radio" name="distance" value={p.value} checked={preset === p.value} onChange={() => setPreset(p.value)} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {preset === "custom" ? (
        <div className="field">
          <label htmlFor="customKm">{labels.custom}</label>
          <input id="customKm" name="customKm" inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} required />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="target">{labels.target}</label>
        <input id="target" name="target" inputMode="numeric" placeholder="1:59:59" value={target} onChange={(e) => setTarget(e.target.value)} />
        <span className="hint">{labels.optional}</span>
      </div>
      <div className="field">
        <span className="small muted">{labels.pace}</span>
        <span className="num" style={{ fontSize: "2.4rem", lineHeight: 1 }} aria-live="polite">{formatPace(pace)} <span className="small muted">/km</span></span>
      </div>
    </div>
  );
}
