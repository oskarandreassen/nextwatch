// app/group/swipe/GroupBar.tsx
"use client";

import { useEffect, useState } from "react";

type Member = { userId: string; displayName: string; initials: string; joinedAt: string };

export default function GroupBar({ code }: { code: string }) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    const load = async () => {
      const res = await fetch(`/api/group/members?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.ok && Array.isArray(data.members)) setMembers(data.members);
    };
    load();
    t = setInterval(load, 10_000);
    return () => { if (t) clearInterval(t); };
  }, [code]);

  const invite = async () => {
    const url = `${location.origin}/group/swipe?code=${encodeURIComponent(code)}`;
    try {
      if ("share" in navigator) {
        // @ts-expect-error share stöds på mobiler
        await navigator.share({ title: "NextWatch group", text: `Join my group: ${code}`, url });
        return;
      }
      if ("clipboard" in navigator && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert("Link copied!");
        return;
      }
    } catch {}
    const ta = document.createElement("textarea");
    ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    alert("Link copied!");
  };

  return (
    <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="text-base font-semibold">Group: {code}</div>
        <div className="flex items-center gap-2">
          {members.map((m) => (
            <div key={m.userId} className="hidden items-center gap-2 rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-200 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-neutral-900">{m.initials}</span>
              <span>{m.displayName}</span>
            </div>
          ))}
          <button onClick={invite} className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800">
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
