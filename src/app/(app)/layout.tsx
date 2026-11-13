import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import { AppChrome } from "../components";

/**
 * Shared chrome of the signed-in app. It stays mounted across navigations, so the tab bar reacts
 * instantly; each page fills only the content column (pages still check the session themselves).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  return <AppChrome t={t}>{children}</AppChrome>;
}
