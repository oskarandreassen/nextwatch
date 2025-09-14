"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function VerifyClient() {
  const qp = useSearchParams();
  const token = qp.get("token");
  const [msg, setMsg] = useState("Verifierar…");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) { setMsg("Saknar token."); return; }
      const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
      if (!alive) return;
      if (res.redirected) {
        location.href = res.url; // -> /onboarding
      } else {
        const d = await res.json().catch(() => null);
        setMsg(d?.error || "Klar.");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  return <main className="p-6 text-neutral-200">{msg}</main>;
}
