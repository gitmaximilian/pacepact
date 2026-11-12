"use client";

import { useState } from "react";

/** Today / yesterday / two days ago as chips, in the device's own calendar; any other date one tap away. */
export function DatePick({ labels }: { labels: { date: string; today: string; yesterday: string; twoDays: string; other: string } }) {
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [choice, setChoice] = useState<"0" | "1" | "2" | "other">("0");
  const [other, setOther] = useState("");
  const value = choice === "other" ? other : day(Number(choice));
  const opts = [["0", labels.today], ["1", labels.yesterday], ["2", labels.twoDays], ["other", labels.other]] as const;
  return (
    <fieldset className="field type-pick">
      <legend>{labels.date}</legend>
      <input type="hidden" name="date" value={value} suppressHydrationWarning />
      <div className="seg">
        {opts.map(([v, l]) => (
          <label key={v}>
            <input type="radio" name="day" value={v} checked={choice === v} onChange={() => setChoice(v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {choice === "other" ? (
        <input type="date" className="date-input" aria-label={labels.date} max={day(0)} value={other} onChange={(e) => setOther(e.target.value)} required />
      ) : null}
    </fieldset>
  );
}
