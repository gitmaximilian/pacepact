import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { param, type SearchParams } from "@/lib/queries";
import { groupMembers, membership } from "@/lib/social/groups";
import { contestError, NewContest } from "@/app/(app)/challenges/new-form";
import {Flash} from "@/app/components";

export const metadata = { title: "New challenge" };

export default async function NewCrewChallenge({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, locale } = await getT();
  const m = await membership(id, user.id);
  if (!m) notFound();
  const members = await groupMembers(id);
  return (
    <>
      <Link href={`/groups/${id}?tab=challenges`} className="small">← {m.group.name}</Link>
      <h1>{t.social.newChallenge}</h1>
      <Flash err={contestError(t, param(await searchParams, "error"))} />
      <NewContest t={t} groupId={id} opponents={members.filter((x) => x.id !== user.id).map((x) => ({ id: x.id, name: x.name }))} />
    </>
  );
}
