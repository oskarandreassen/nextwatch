// app/group/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Friend = { userId: string; displayName: string; initials: string };

async function createGroup(): Promise<string | null> {
  const res = await fetch("/api/group", { method: "POST" });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.ok ? (data.group?.code as string) : null;
}

export default function GroupPage() {
  const [tab, setTab] = useState<"group" | "friends">("group");
  const [codeInput, setCodeInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    if (tab !== "friends") return;
    let alive = true;
    (async () => {
      const res = await fetch("/api/group/my-friends", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!alive) return;
      if (data?.ok && Array.isArray(data.friends)) setFriends(data.friends);
    })();
    return () => { alive = false; };
  }, [tab]);

  const goToCode = () => {
    const c = codeInput.trim().toUpperCase();
    if (c) location.href = `/group/swipe?code=${encodeURIComponent(c)}`;
  };

  const onCreate = async () => {
    setCreating(true);
    const code = await createGroup();
    setCreating(false);
    if (code) location.href = `/group/swipe?code=${encodeURIComponent(code)}`;
    else alert("Kunde inte skapa grupp.");
  };

  const inviteLink = (c: string) => `${location.origin}/group/swipe?code=${encodeURIComponent(c)}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Group</h1>

      <div className="mb-6 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 p-1">
        <button
          className={`rounded-md px-3 py-1 text-sm ${tab === "group" ? "bg-white text-neutral-900" : "text-neutral-200"}`}
          onClick={() => setTab("group")}
        >
          Group
        </button>
        <button
          className={`rounded-md px-3 py-1 text-sm ${tab === "friends" ? "bg-white text-neutral-900" : "text-neutral-200"}`}
          onClick={() => setTab("friends")}
        >
          Friends
        </button>
      </div>

      {tab === "group" ? (
        <div className="space-y-6">
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-3 text-lg font-medium">Join with code</div>
            <div className="flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none"
                placeholder="ABC123"
              />
              <button
                className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900"
                onClick={goToCode}
              >
                Join
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-3 text-lg font-medium">Create a new group</div>
            <button
              disabled={creating}
              onClick={onCreate}
              className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900 disabled:opacity-60"
            >
              {creating ? "Skapar…" : "Create group"}
            </button>
          </section>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-3 text-lg font-medium">Your friends</div>
          {friends.length === 0 ? (
            <div className="text-sm text-neutral-400">Inga vänner än – gå med i en grupp först.</div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {friends.map((f) => (
                <li key={f.userId} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-900">
                      {f.initials}
                    </span>
                    <span className="text-sm">{f.displayName}</span>
                  </div>
                  <button
                    className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
                    onClick={async () => {
                      const code = await createGroup();
                      if (!code) { alert("Kunde inte skapa grupp."); return; }
                      const link = inviteLink(code);
                      try {
                        // Web Share om finns
                        if ("share" in navigator && typeof (navigator as any).share === "function") {
                          await (navigator as any).share({
                            title: "NextWatch group",
                            text: `Join my group: ${code}`,
                            url: link,
                          });
                        } else if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(link);
                          alert("Invite copied!");
                        } else {
                          const ta = document.createElement("textarea");
                          ta.value = link; document.body.appendChild(ta); ta.select();
                          document.execCommand("copy"); document.body.removeChild(ta);
                          alert("Invite copied!");
                        }
                        // gå direkt till gruppen man skapade
                        location.href = `/group/swipe?code=${encodeURIComponent(code)}`;
                      } catch {
                        location.href = `/group/swipe?code=${encodeURIComponent(code)}`;
                      }
                    }}
                  >
                    Invite
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
