import { BackLink } from "@/app/components";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { contestError, NewContest } from "@/app/(app)/challenges/new-form";
import {Flash} from "@/app/components";

export const metadata = { title: "New challenge" };

export default async function NewPersonalChallenge({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { t, locale } = await getT();
  return (
    <>
      <BackLink href="/challenges" label={t.social.personalTitle} />
      <h1>{t.social.personalCta}</h1>
      <Flash err={contestError(t, param(await searchParams, "error"))} />
      <NewContest t={t} groupId={null} opponents={[]} />
    </>
  );
}
