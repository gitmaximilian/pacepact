"use client";

import { useActionState, useState } from "react";
import { createAppleToken } from "../actions";

export interface AppleLabels {
  setup: string;
  again: string;
  step1: string;
  step1Link: string;
  step2: string;
  oneTap: string;
  oneTapHint: string;
  manual: string;
  urlLabel: string;
  headerKey: string;
  headerValue: string;
  settings: string[];
  step3: string;
  tokenOnce: string;
  copy: string;
  copied: string;
  shortcut: {
    title: string;
    install: string;
    steps: string[];
    keyLabel: string;
    haeTitle: string;
  };
}

function Copy({ value, labels }: { value: string; labels: Pick<AppleLabels, "copy" | "copied"> }) {
  const [done, setDone] = useState(false);
  return (
    <div className="copy-row">
      <code>{value}</code>
      <button
        type="button"
        className="btn small ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          } catch {
            window.prompt(labels.copy, value);
          }
        }}
      >
        {done ? labels.copied : labels.copy}
      </button>
    </div>
  );
}

/**
 * Creates a sync token and shows how to point Health Auto Export at Pacepact.
 * The token is shown once; only its hash is stored.
 */
export function AppleSetup({ url, labels: l, hasToken, shortcutUrl }: { url: string; labels: AppleLabels; hasToken: boolean; shortcutUrl: string | null }) {
  const [state, action, pending] = useActionState(createAppleToken, { token: null });
  if (!state.token) {
    return (
      <form action={action}>
        <button className="btn signal" disabled={pending}>{hasToken ? l.again : l.setup}</button>
      </form>
    );
  }
  const bearer = `Bearer ${state.token}`;
  const deepLink =
    "com.HealthExport://automation?" +
    new URLSearchParams({
      url,
      name: "Pacepact",
      headers: `Authorization,${bearer}`,
      format: "json",
      datatype: "workouts",
      aggregatedata: "false",
      period: "lastsync",
      syncinterval: "hours",
      syncquantity: "1",
      enabled: "true",
    }).toString();
  const hae = (
    <ol className="steps">
      <li>
        {l.step1} <a href="https://apps.apple.com/app/id1115567069" rel="noopener">{l.step1Link}</a>
      </li>
      <li>
        {l.step2}
        <div className="row" style={{ marginTop: 8 }}>
          <a className="btn signal" href={deepLink}>{l.oneTap}</a>
        </div>
        <p className="small muted">{l.oneTapHint}</p>
        <details>
          <summary>{l.manual}</summary>
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            <span className="small">{l.urlLabel}</span>
            <Copy value={url} labels={l} />
            <span className="small">{l.headerKey}: <code>Authorization</code> · {l.headerValue}:</span>
            <Copy value={bearer} labels={l} />
            <ul className="small">{l.settings.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </details>
      </li>
      <li>{l.step3}</li>
      <li className="small muted">{l.tokenOnce}</li>
    </ol>
  );
  if (!shortcutUrl) return hae;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 8 }}>
        <strong>{l.shortcut.title}</strong>
        <ol className="steps">
          <li>
            <a className="btn signal" href={shortcutUrl} rel="noopener">{l.shortcut.install}</a>
          </li>
          <li>
            {l.shortcut.keyLabel}
            <Copy value={state.token} labels={l} />
          </li>
          {l.shortcut.steps.map((s) => <li key={s}>{s}</li>)}
          <li className="small muted">{l.tokenOnce}</li>
        </ol>
      </div>
      <details>
        <summary><strong>{l.shortcut.haeTitle}</strong></summary>
        <div style={{ marginTop: 10 }}>{hae}</div>
      </details>
    </div>
  );
}
