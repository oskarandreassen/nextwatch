"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../components/layouts/AppShell";

type JoinOk = { ok: true; code: string };
type JoinErr = { ok: false; error: string };
type JoinResp = JoinOk | JoinErr;

export default function GroupPage() {
  const r = useRouter();
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function createGroup() {
    setBusy("create");
    setErr(null);
    try {
      const res = await fetch("/api/group/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}), // utan code => servern skapar ny
      });
      const js: JoinResp = await res.json();
      if (!js.ok) throw new Error(js.error);
      r.push(`/group/swipe?code=${encodeURIComponent(js.code)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function joinGroup() {
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 6) {
      setErr("Ange en giltig gruppkod (6 tecken).");
      return;
    }
    setBusy("join");
    setErr(null);
    try {
      const res = await fetch("/api/group/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const js: JoinResp = await res.json();
      if (!js.ok) throw new Error(js.error);
      r.push(`/group/swipe?code=${encodeURIComponent(js.code)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">Grupp</h1>

        {err && <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-200">{err}</div>}

        <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-2 text-lg font-semibold">Skapa ny grupp</h2>
          <p className="mb-3 text-sm opacity-80">Vi genererar automatiskt en gruppkod som du kan dela med andra.</p>
          <button
            onClick={createGroup}
            disabled={busy !== null}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/15 disabled:opacity-60"
          >
            {busy === "create" ? "Skapar…" : "Skapa grupp"}
          </button>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-2 text-lg font-semibold">Gå med i grupp</h2>
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Gruppkod (t.ex. LZXN9R)"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 outline-none"
              maxLength={6}
              spellCheck={false}
            />
            <button
              onClick={joinGroup}
              disabled={busy !== null}
              className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/15 disabled:opacity-60"
            >
              {busy === "join" ? "Går med…" : "Gå med"}
            </button>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
