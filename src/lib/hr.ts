/**
 * Average heart rate is health data (Art. 9 GDPR). Crews see it only for runners whose consent
 * explicitly covers showing it to their crews. That wording went live with HR_CREW_SINCE; older
 * consents only covered storing it for the runner, so those runners are asked to confirm again.
 * (Set conservatively after the release: a consent given in between is simply asked again.)
 */
export const HR_CREW_SINCE = new Date("2026-11-13T09:50:00Z");

export function hrVisibleToCrew(hrConsentAt: Date | null | undefined): boolean {
  return !!hrConsentAt && hrConsentAt.getTime() >= HR_CREW_SINCE.getTime();
}

/** Consent exists but predates the crew wording: offer to confirm the new wording. */
export function hrNeedsRenewal(hrConsentAt: Date | null | undefined): boolean {
  return !!hrConsentAt && !hrVisibleToCrew(hrConsentAt);
}
