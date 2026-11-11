"use client";

import { useActionState } from "react";
import { createApiToken } from "../actions";

interface Props {
  ingestUrl: string;
  labels: { label: string; create: string; newToken: string; example: string };
}

export function TokenForm({ ingestUrl, labels }: Props) {
  const [state, action, pending] = useActionState(createApiToken, { token: null });
  const example = `curl -X POST ${ingestUrl} \\
  -H "Authorization: Bearer ${state.token ?? "pp_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{"startedAt":"2026-11-12T18:30:00Z","distanceKm":5.2,"durationSec":1980,"avgHr":158,"runType":"run1","source":"apple-health"}'`;
  return (
    <>
      {state.token ? (
        <div className="stack" style={{ gap: 6 }}>
          <strong>{labels.newToken}</strong>
          <div className="code" data-testid="new-token">{state.token}</div>
        </div>
      ) : null}
      <form action={action} className="row">
        <input name="label" placeholder="Apple Shortcut" maxLength={60} aria-label={labels.label} style={{ maxWidth: 260 }} />
        <button className="btn" disabled={pending}>{labels.create}</button>
      </form>
      <strong className="small">{labels.example}</strong>
      <div className="code">{example}</div>
    </>
  );
}
