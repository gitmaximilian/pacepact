import "server-only";
import { cookies } from "next/headers";
import { currentUser } from "../auth";
import { DEFAULT_LOCALE, getDictionary, isLocale, LOCALE_COOKIE, type Locale } from "./index";

/** Signed-in users get their saved language; visitors get the cookie or English. */
export async function getLocale(): Promise<Locale> {
  const user = await currentUser();
  if (user && isLocale(user.locale)) return user.locale;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
