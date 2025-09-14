"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InlineLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErr(json?.message ?? "Kunde inte logga in");
        setBusy(false);
        return;
      }
      router.replace("/swipe");
    } catch (e) {
      setErr("Nätverksfel");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 w-full max-w-sm space-y-3">
      <input
        type="email"
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 outline-none ring-1 ring-zinc-800"
        placeholder="E-post"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 outline-none ring-1 ring-zinc-800"
        placeholder="Lösenord"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-white/10 px-4 py-3 font-medium hover:bg-white/15 disabled:opacity-50"
      >
        {busy ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}
