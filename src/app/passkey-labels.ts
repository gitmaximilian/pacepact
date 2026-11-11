import type { Dictionary } from "@/lib/i18n";
import type { PasskeyLabels } from "./passkey-client";

export function passkeyLabels(t: Dictionary): PasskeyLabels {
  const a = t.auth;
  return {
    name: a.name,
    nameHint: a.nameHint,
    submitSignIn: a.submitSignIn,
    submitSignUp: a.submitSignUp,
    working: a.working,
    terms: a.terms,
    privacy: t.legal.privacy,
    hrConsent: a.hrConsent,
    errUnsupported: a.errUnsupported,
    errCancelled: a.errCancelled,
    errUnknown: a.errUnknown,
    errRate: a.errRate,
    errInput: a.errInput,
    errTerms: a.errTerms,
  };
}
