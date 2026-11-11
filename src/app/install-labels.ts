import type { Dictionary } from "@/lib/i18n";
import type { InstallLabels } from "./install-prompt";

export const installLabels = (t: Dictionary): InstallLabels => ({ ...t.install });
