// app/group/swipe/GroupBar.tsx
"use client";

import { useEffect, useState } from "react";

type Member = { userId: string; displayName: string; initials: string; joinedAt: string };

export default function GroupBar({ code }: { code: string }) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const load = async () => {
      const res = await fetch(`/api/group/members?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.ok && Array.isArray(data.members)) setMembers(data.members);
    };
    load();
    timer = setInterval(load, 10_000);
    return () => { if (timer) clearInterval(timer); };
  }, [code]);

  return (
    <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="text-base font-semibold">Grupp: {code}</div>
        <div className="flex gap-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-200">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-neutral-900">{m.initials}</span>
              <span className="hidden sm:block">{m.displayName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
