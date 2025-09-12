// app/group/swipe/GroupBar.tsx
"use client";

import { useEffect, useState } from "react";

type Member = { userId: string; displayName: string; initials: string; joinedAt: string };

// Hjälpare för Web Share + Clipboard med trygga typer
type ShareData = { title?: string; text?: string; url?: string };
type NavigatorWithShare = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText?: (text: string) => Promise<void> };
};

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
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [code]);

  const invite = async () => {
    const url = `${location.origin}/group/swipe?code=${encodeURIComponent(code)}`;
    try {
      const nav = (typeof navigator !== "undefined" ? navigator : undefined) as NavigatorWithShare | undefined;

      if (nav?.share) {
        await nav.share({ title: "NextWatch group", text: `Join my group: ${code}`, url });
        return;
      }

      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        alert("Länk kopierad till urklipp!");
        return;
      }

      // Fallback för äldre webbläsare
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Länk kopierad till urklipp!");
    } catch {
      alert("Kunde inte dela länken. Kopiera manuellt: " + url);
    }
  };

  return (
    <div className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="text-base font-semibold">Grupp: {code}</div>
        <div className="flex items-center gap-2">
          {members.map((m) => (
            <div
              key={m.userId}
              className="hidden items-center gap-2 rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-200 sm:flex"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-neutral-900">
                {m.initials}
              </span>
              <span>{m.displayName}</span>
            </div>
          ))}
          <button
            onClick={invite}
            className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            Bjud in
          </button>
        </div>
      </div>
    </div>
  );
}
