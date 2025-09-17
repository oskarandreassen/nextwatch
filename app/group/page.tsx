// app/group/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import Client from "./Client";

type MemberRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  joined_at: Date;
};

type GroupInfo = {
  code: string;
  members: Array<{
    userId: string;
    username: string | null;
    displayName: string | null;
    joinedAt: string;
  }>;
};

export default async function GroupPage() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  const code = jar.get("nw_group")?.value ?? null;

  // Om inte inloggad → låt klienten hantera redirect/empty state
  if (!uid) {
    const empty: GroupInfo = { code: "", members: [] };
    return <Client initial={empty} />;
  }

  // Hämta aktiv grupp från cookie om finns; annars visa tom
  if (!code) {
    const empty: GroupInfo = { code: "", members: [] };
    return <Client initial={empty} />;
  }

  const rows = await prisma.$queryRaw<MemberRow[]>`
    SELECT gm.user_id, u.username, p.display_name, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN profiles p ON p.user_id = gm.user_id
    WHERE gm.group_code = ${code}
    ORDER BY gm.joined_at ASC
  `;

  const initial: GroupInfo = {
    code,
    members: rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      joinedAt: r.joined_at.toISOString(),
    })),
  };

  return <Client initial={initial} />;
}
