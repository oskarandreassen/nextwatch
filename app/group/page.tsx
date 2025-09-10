"use client";
import React, { useCallback, useState } from "react";

export default function GroupPage() {
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<{ size: number; cap: number; premium: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const createGroup = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    const r = await fetch("/api/group/join", { method: "POST" });
    const j = await r.json();
    if (!j?.ok) {
      setErr(j?.error || "Kunde inte skapa grupp.");
      return;
    }
    setCode(j.code);
    setInfo({ size: j.size, cap: j.cap, premium: j.premium });
    setOkMsg(`Skapade grupp ${j.code}`);
  }, []);

  const joinGroup = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    const c = code.trim().toUpperCase();
    if (!c) {
      setErr("Ange kod.");
      return;
    }
    const r = await fetch("/api/group/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: c }),
    });
    const j = await r.json();
    if (!j?.ok) {
      if (j?.error === "group_full") {
        setErr(`Gruppen är full (${j.size}/${j.cap}).`);
      } else if (j?.error === "group not found") {
        setErr("Gruppen finns inte.");
      } else {
        setErr(j?.error || "Kunde inte gå med i grupp.");
      }
      return;
    }
    setCode(j.code);
    setInfo({ size: j.size, cap: j.cap, premium: j.premium });
    setOkMsg(`Gick med i grupp ${j.code}`);
  }, [code]);

  const refreshInfo = useCallback(async () => {
    setErr(null);
    setOkMsg(null);
    const c = code.trim().toUpperCase();
    if (!c) return;
    const r = await fetch(`/api/group/info?code=${encodeURIComponent(c)}`, { cache: "no-store" });
    const j = await r.json();
    if (j?.ok) setInfo({ size: j.size, cap: j.cap, premium: j.premium });
  }, [code]);

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Grupp</h1>
      <p className="opacity-80 mb-4">Skapa eller gå med i en grupp med 6-teckenskod.</p>

      <div className="mb-4 flex gap-2">
        <button className="px-4 py-2 rounded-xl border" onClick={createGroup}>
          Skapa ny grupp
        </button>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="KOD"
          className="px-3 py-2 rounded-xl border font-mono w-32"
        />
        <button className="px-4 py-2 rounded-xl border" onClick={joinGroup}>
          Gå med
        </button>
        <button className="px-4 py-2 rounded-xl border" onClick={refreshInfo}>
          Uppdatera
        </button>
      </div>

      {okMsg && <div className="mb-3 text-green-600">{okMsg}</div>}
      {err && <div className="mb-3 text-red-600">{err}</div>}

      {info && (
        <div className="rounded-xl border p-3">
          <div className="text-sm">Grupp <span className="font-mono">{code.toUpperCase()}</span></div>
          <div className="text-lg font-medium">
            Medlemmar: {info.size}/{info.cap} {info.premium ? "(Premium-cap)" : "(Free-cap)"}
          </div>
          <div className="mt-2 text-sm">
            {info.premium
              ? "Premium i gruppen ger större kapacitet."
              : "Uppgradera någon i gruppen för större kapacitet."}
          </div>
          <div className="mt-3">
            <a className="underline" href={`/group/swipe?code=${encodeURIComponent(code)}`}>
              Starta grupp-swipe →
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
