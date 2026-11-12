"use client";

import { useState, type ReactNode } from "react";

/** Opens the system share sheet (phones) or copies the invite link. */
export function ShareInvite({ url, text, labels }: { url: string; text: string; labels: { share: string; copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Pacepact", text, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(labels.copy, url);
    }
  }
  return (
    <button type="button" className="btn signal" onClick={onClick}>
      {copied ? labels.copied : labels.share}
    </button>
  );
}

/** A submit button that asks for confirmation first. */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
