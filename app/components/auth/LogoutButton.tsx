// app/components/auth/LogoutButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { className?: string };

export default function LogoutButton({ className }: Props) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      r.push("/");
      r.refresh();
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={[
        "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className ?? "",
      ].join(" ").trim()}
    >
      {busy ? "Loggar ut…" : "Logga ut"}
    </button>
  );
}
