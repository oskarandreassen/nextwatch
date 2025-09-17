// app/api/friends/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Row = {
  user_id: string;
  friend_id: string;
  created_at: Date;

  user_username: string | null;
  user_display_name: string | null;
  friend_username: string | null;
  friend_display_name: string | null;
};

type FriendDTO = {
  id: string;
  userId: string;
  friendId: string;
  createdAt: string;
  other: {
    id: string;
    username: string | null;
    displayName: string | null;
  };
};

type Ok = { ok: true; friends: FriendDTO[] };
type Err = { ok: false; message: string };

export async function GET() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) {
    const body: Err = { ok: false, message: "Ingen session." };
    return NextResponse.json(body, { status: 401 });
  }

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      f.user_id,
      f.friend_id,
      f.created_at,
      u1.username AS user_username,
      p1.display_name AS user_display_name,
      u2.username AS friend_username,
      p2.display_name AS friend_display_name
    FROM friendships f
    JOIN users u1 ON u1.id = f.user_id
    LEFT JOIN profiles p1 ON p1.user_id = f.user_id
    JOIN users u2 ON u2.id = f.friend_id
    LEFT JOIN profiles p2 ON p2.user_id = f.friend_id
    WHERE f.user_id = ${uid} OR f.friend_id = ${uid}
    ORDER BY f.created_at DESC
  `;

  const friends: FriendDTO[] = rows.map((r) => {
    const otherIsFriendSide = r.user_id === uid;
    const otherId = otherIsFriendSide ? r.friend_id : r.user_id;
    const otherUsername = otherIsFriendSide ? r.friend_username : r.user_username;
    const otherDisplay = otherIsFriendSide ? r.friend_display_name : r.user_display_name;

    return {
      id: `${r.user_id}_${r.friend_id}`,
      userId: r.user_id,
      friendId: r.friend_id,
      createdAt: r.created_at.toISOString(),
      other: {
        id: otherId,
        username: otherUsername,
        displayName: otherDisplay,
      },
    };
  });

  const body: Ok = { ok: true, friends };
  return NextResponse.json(body);
}
