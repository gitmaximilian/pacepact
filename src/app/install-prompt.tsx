"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Logo } from "./logo";

/**
 * "Install as app", like Rookie: Android/Chrome offers a real install dialog
 * (beforeinstallprompt); iPhone/iPad only via Share → Add to Home Screen.
 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type Platform = "ios" | "ipad" | "android" | "other";
interface State { platform: Platform; standalone: boolean; canPrompt: boolean; banner: boolean; guide: boolean; ready: boolean }

const DISMISS_KEY = "pacepact:installDismissed";
const ASK_AGAIN_DAYS = 30;

let state: State = { platform: "other", standalone: false, canPrompt: false, banner: false, guide: false, ready: false };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const setState = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER: State = state;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return "ios";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ipad";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function recentlyDismissed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < ASK_AGAIN_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  const platform = detectPlatform();
  const standalone =
    matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  setState({ platform, standalone, ready: true });
  if (standalone) return;
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    setState({ canPrompt: true, banner: !recentlyDismissed() });
  });
  addEventListener("appinstalled", () => setState({ banner: false, guide: false, standalone: true }));
  // iPhone/iPad have no browser event: ask ourselves after a moment.
  if ((platform === "ios" || platform === "ipad") && !recentlyDismissed()) setTimeout(() => setState({ banner: true }), 1800);
}

async function startInstall() {
  if (deferred) {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    setState({ canPrompt: false, banner: false });
    if (outcome === "dismissed") dismiss();
    return;
  }
  setState({ banner: false, guide: true });
}

function dismiss() {
  setState({ banner: false, guide: false });
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode: asks again next visit */
  }
}

export interface InstallLabels {
  title: string; short: string; install: string; how: string; later: string; gotIt: string;
  guideTitle: string; guideLead: string; ios1: string; ios1ipad: string; ios2: string; ios3: string;
  iosNote: string; other1: string; other2: string; settingsRow: string; installed: string;
}

function useInstall() {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  useEffect(init, []);
  return s;
}

function Guide({ l, s }: { l: InstallLabels; s: State }) {
  if (!s.guide) return null;
  const apple = s.platform === "ios" || s.platform === "ipad";
  return (
    <>
      <div className="sheet-backdrop" role="presentation" onClick={() => setState({ guide: false })} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={l.guideTitle}>
        <h2>{l.guideTitle}</h2>
        <p className="small muted">{l.guideLead}</p>
        {apple ? (
          <>
            <ol>
              <li><span className="ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M8 11H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2" /></svg></span><span>{s.platform === "ipad" ? l.ios1ipad : l.ios1}</span></li>
              <li><span className="ico" aria-hidden="true">＋</span><span>{l.ios2}</span></li>
              <li><span className="ico" aria-hidden="true">✓</span><span>{l.ios3}</span></li>
            </ol>
            <p className="small muted">{l.iosNote}</p>
          </>
        ) : (
          <ol>
            <li><span className="ico" aria-hidden="true">⋮</span><span>{l.other1}</span></li>
            <li><span className="ico" aria-hidden="true">＋</span><span>{l.other2}</span></li>
          </ol>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => setState({ guide: false })}>{l.gotIt}</button>
          <button type="button" className="btn ghost" onClick={dismiss}>{l.later}</button>
        </div>
      </div>
    </>
  );
}

/** Banner on overview pages plus the step-by-step guide. */
export function InstallPrompt({ labels: l }: { labels: InstallLabels }) {
  const s = useInstall();
  return (
    <>
      {s.banner && !s.standalone ? (
        <div className="install-banner" role="dialog" aria-label={l.title}>
          <Logo size={40} tile />
          <span className="text"><b>{l.title}</b><span className="muted">{l.short}</span></span>
          <button type="button" className="btn small signal" onClick={startInstall}>{s.canPrompt ? l.install : l.how}</button>
          <button type="button" className="x" onClick={dismiss} aria-label={l.later}>×</button>
        </div>
      ) : null}
      <Guide l={l} s={s} />
    </>
  );
}

/** Row for the settings page. The guide itself is rendered by <InstallPrompt> in the page shell. */
export function InstallRow({ labels: l }: { labels: InstallLabels }) {
  const s = useInstall();
  if (!s.ready) return null;
  if (s.standalone) return <p className="small muted">{l.installed}</p>;
  return (
    <button type="button" className="btn ghost small" onClick={startInstall}>{l.settingsRow}</button>
  );
}
