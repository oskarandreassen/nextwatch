// app/group/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import GroupClient from "./GroupClient";

export type PublicMember = {
  userId: string;
  username: string | null;
  displayName: string | null;
  joinedAt: string; // ISO
};

export type GroupInitial = {
  code: string | null;
  members: PublicMember[];
  region?: string;
  meUserId: string | null; // <-- nytt fält till klienten (påverkar inte UI)
};

export default async function GroupPage() {
  const cookieStore = await cookies();
  const me = cookieStore.get("nw_uid")?.value ?? null;
  const code = cookieStore.get("nw_group")?.value ?? null;

  if (!code) {
    const initial: GroupInitial = { code: null, members: [], meUserId: me };
    return <GroupClient initial={initial} />;
  }

  const rows = await prisma.$queryRaw<
    Array<{ user_id: string; joined_at: Date; username: string | null; display_name: string | null }>
  >`
    SELECT gm.user_id, gm.joined_at, p.username, pr.display_name
    FROM group_members gm
    LEFT JOIN users p   ON p.id = gm.user_id
    LEFT JOIN profiles pr ON pr.user_id = gm.user_id
    WHERE gm.group_code = ${code}
    ORDER BY gm.joined_at ASC
  `;

  const initial: GroupInitial = {
    code,
    meUserId: me,
    members: rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      joinedAt: r.joined_at.toISOString(),
    })),
  };

  return <GroupClient initial={initial} />;
}
