/**
 * Facts used by the privacy notice. Keep these in sync with the real setup and
 * with docs/legal/*.md. Changing the hosting means updating this file first.
 */
export const LEGAL = {
  controller: "Maximilian Auer, Wien, Österreich",
  controllerEn: "Maximilian Auer, Vienna, Austria",
  email: "contact@maximilianauer.at",
  legalUrl: "https://maximilianauer.at/legal/",
  authority: "https://www.dsb.gv.at",
  updated: "2026-11-11",
  hosting: {
    provider: "Cloudflare, Inc.",
    services: "Cloudflare Workers und D1",
    servicesEn: "Cloudflare Workers and D1",
    location: "EU (Gerichtsbarkeit „EU“)",
    locationEn: "EU (jurisdiction “EU”)",
    dpa: "https://www.cloudflare.com/cloudflare-customer-dpa/",
  },
  minAge: 14,
} as const;

export const INACTIVE_ACCOUNT_DAYS = 730;
