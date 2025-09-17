// app/group/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import prisma from "@/lib/prisma";
import GroupClient from "./GroupClient";

export type PublicMember = {
  id: string;
  username: string | null;
  displayName: string | null;
  providers: string[];
};

export type GroupInitial = {
  code: string | null;
  region: string;
  members: PublicMember[];
};

function pickRegionFromHeaders(h: Headers): string {
  const vercel = h.get("x-vercel-ip-country");
  if (vercel && /^[A-Z]{2}$/.test(vercel)) return vercel;
  const al = h.get("accept-language");
  if (!al) return "SE";
  const m = al.match(/-([A-Z]{2})/);
  return m?.[1] ?? "SE";
}

export default async function GroupPage() {
  const jar = await cookies();
  const hdr = await headers();

  const uid = jar.get("nw_uid")?.value ?? null;
  const code = (jar.get("nw_group")?.value ?? "").trim().toUpperCase() || null;
  const region = jar.get("nw_region")?.value ?? pickRegionFromHeaders(hdr);

  let members: PublicMember[] = [];

  if (uid && code) {
    const rows = await prisma.groupMember.findMany({
      where: { groupCode: code },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, providers: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
      take: 200,
    });

    members = rows.map((r) => {
      const provRaw = r.user.profile?.providers;
      const providers = Array.isArray(provRaw)
        ? (provRaw as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      return {
        id: r.user.id,
        username: r.user.username ?? null,
        displayName: r.user.profile?.displayName ?? null,
        providers,
      };
    });
  }

  const initial: GroupInitial = {
    code,
    region,
    members,
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <GroupClient initial={initial} />
    </main>
  );
}
