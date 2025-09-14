"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState(""); // valfritt, men trevligt vid första onboard
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSending(true);
    try {
      const res = await fetch("/api/auth/request-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const json = await res.json();
      if (json?.ok) {
        setSent(true);
      } else {
        alert(json?.error ?? "Något gick fel.");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Nätverksfel");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-[calc(100svh)] bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold">NextWatch</h1>
          <p className="text-zinc-400">
            Logga in eller få en magisk länk via e-post.
          </p>
        </div>

        {!sent ? (
          <form onSubmit={requestLink} className="space-y-4 bg-zinc-900/60 rounded-2xl p-5 backdrop-blur">
            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">E-post</label>
              <input
                type="email"
                className="w-full rounded-xl bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@mail.se"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-zinc-300">Namn (valfritt)</label>
              <input
                type="text"
                className="w-full rounded-xl bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anna Andersson"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 px-4 py-2 font-medium"
            >
              {sending ? "Skickar…" : "Skicka inloggningslänk"}
            </button>
          </form>
        ) : (
          <div className="bg-zinc-900/60 rounded-2xl p-5 text-center space-y-2">
            <div className="text-lg">🚀 Länk skickad!</div>
            <p className="text-zinc-400">
              Kolla inkorgen för <span className="font-mono">{email}</span>.
            </p>
            <button
              onClick={() => router.push("/onboarding")}
              className="mt-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2"
            >
              Fortsätt till onboarding
            </button>
          </div>
        )}

        <div className="text-center text-sm text-zinc-500">
          Redan klar?{" "}
          <button
            className="text-cyan-400 hover:underline"
            onClick={() => router.push("/swipe")}
          >
            Gå till Recommendations
          </button>
        </div>
      </div>
    </main>
  );
}
