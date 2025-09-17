// app/group/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import GroupClient from "./GroupClient";

// Dessa typer exporteras för att matcha GroupClient.tsx:s import
export type PublicMember = {
  userId: string;
  username: string | null;
  displayName: string | null;
  joinedAt: string; // ISO
};

export type GroupInitial = {
  code: string;
  members: PublicMember[];
};

type MemberRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  joined_at: Date;
};

export default async function GroupPage() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  const code = jar.get("nw_group")?.value ?? null;

  // Om inte inloggad eller ingen aktiv grupp → låt klienten visa tomt state
  if (!uid || !code) {
    const empty: GroupInitial = { code: "", members: [] };
    return <GroupClient initial={empty} />;
  }

  const rows = await prisma.$queryRaw<MemberRow[]>`
    SELECT gm.user_id, u.username, p.display_name, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN profiles p ON p.user_id = gm.user_id
    WHERE gm.group_code = ${code}
    ORDER BY gm.joined_at ASC
  `;

  const initial: GroupInitial = {
    code,
    members: rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      joinedAt: r.joined_at.toISOString(),
    })),
  };

  return <GroupClient initial={initial} />;
}
