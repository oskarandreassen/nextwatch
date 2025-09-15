"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function VerifyPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token");
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState<string>("Verifierar…");

  useEffect(() => {
    async function run() {
      if (!token) {
        setState("err");
        setMsg("Token saknas.");
        return;
      }
      try {
        const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        const data: { ok?: boolean; message?: string } = await res.json();
        if (!res.ok || !data?.ok) {
          setState("err");
          setMsg(data?.message || "Ett fel uppstod.");
          return;
        }
        setState("ok");
        setMsg("Din e-post är verifierad. Välkommen!");
        setTimeout(() => router.replace("/swipe"), 1000);
      } catch (e) {
        setState("err");
        setMsg(e instanceof Error ? e.message : "Ett fel uppstod.");
      }
    }
    void run();
  }, [token, router]);

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
        <h1 className="mb-3 text-2xl font-semibold">Verifierar e-post…</h1>
        {state === "loading" && <p className="text-white/70">{msg}</p>}
        {state === "ok" && <p className="text-emerald-400">{msg}</p>}
        {state === "err" && (
          <>
            <p className="mb-4 text-rose-400">{msg}</p>
            <Link href="/" className="underline">Till startsidan</Link>
          </>
        )}
      </div>
    </div>
  );
}
