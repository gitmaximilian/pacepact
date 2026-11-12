"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
import Link from "next/link";
import { useState, type FormEvent } from "react";

export interface PasskeyLabels {
  name: string;
  nameHint: string;
  submitSignIn: string;
  submitSignUp: string;
  working: string;
  terms: string;
  privacy: string;
  hrConsent: string;
  errUnsupported: string;
  errCancelled: string;
  errUnknown: string;
  errRate: string;
  errInput: string;
  errTerms: string;
}

async function post(url: string, body: unknown): Promise<Json> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json: Json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "input");
  return json;
}

function message(err: unknown, l: PasskeyLabels): string {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : "";
  if (name === "NotAllowedError" || name === "AbortError") return l.errCancelled;
  if (msg === "unknown") return l.errUnknown;
  if (msg === "rate") return l.errRate;
  if (msg === "terms") return l.errTerms;
  return l.errInput;
}

export function SignUpForm({ labels: l, locale, join }: { labels: PasskeyLabels; locale: string; join?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!browserSupportsWebAuthn()) return setError(l.errUnsupported);
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const optionsJSON = await post("/api/auth/register/options", {
        mode: "register",
        name: String(fd.get("name") ?? ""),
        terms: fd.get("terms") === "on",
        hrConsent: fd.get("hrConsent") === "on",
        locale,
      });
      const response = await startRegistration({ optionsJSON });
      await post("/api/auth/register/verify?mode=register", response);
      window.location.assign(join ? `/welcome?join=${encodeURIComponent(join)}` : "/welcome");
    } catch (err) {
      setError(message(err, l));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="form">
      {error ? <p className="flash err" role="alert">{error}</p> : null}
      <div className="field">
        <label htmlFor="name">{l.name}</label>
        <input id="name" name="name" autoComplete="nickname" maxLength={60} required />
        <span className="hint">{l.nameHint}</span>
      </div>
      <label className="check" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" name="terms" required />
        <span>{l.terms} <Link href="/privacy" target="_blank">{l.privacy}</Link></span>
      </label>
      <label className="check" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" name="hrConsent" />
        <span className="small">{l.hrConsent}</span>
      </label>
      <button className="btn signal" disabled={busy}>{busy ? l.working : l.submitSignUp}</button>
    </form>
  );
}

export function SignInButton({ labels: l, next }: { labels: PasskeyLabels; next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onClick() {
    if (!browserSupportsWebAuthn()) return setError(l.errUnsupported);
    setBusy(true);
    setError(null);
    try {
      const optionsJSON = await post("/api/auth/login/options", {});
      const response = await startAuthentication({ optionsJSON });
      await post("/api/auth/login/verify", response);
      window.location.assign(next ?? "/");
    } catch (err) {
      setError(message(err, l));
      setBusy(false);
    }
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      {error ? <p className="flash err" role="alert">{error}</p> : null}
      <button type="button" className="btn" onClick={onClick} disabled={busy}>{busy ? l.working : l.submitSignIn}</button>
    </div>
  );
}

export function AddPasskeyButton({ label, done, labels: l }: { label: string; done: string; labels: PasskeyLabels }) {
  const [state, setState] = useState<{ busy: boolean; ok: boolean; error: string | null }>({ busy: false, ok: false, error: null });
  async function onClick() {
    if (!browserSupportsWebAuthn()) return setState({ busy: false, ok: false, error: l.errUnsupported });
    setState({ busy: true, ok: false, error: null });
    try {
      const optionsJSON = await post("/api/auth/register/options", { mode: "add" });
      const response = await startRegistration({ optionsJSON });
      await post("/api/auth/register/verify?mode=add", response);
      window.location.assign("/settings?passkey=added");
    } catch (err) {
      setState({ busy: false, ok: false, error: message(err, l) });
    }
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      {state.error ? <p className="flash err" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="flash ok">{done}</p> : null}
      <div><button type="button" className="btn small" onClick={onClick} disabled={state.busy}>{state.busy ? l.working : label}</button></div>
    </div>
  );
}
