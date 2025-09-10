"use client";

import { useState } from "react";

export default function GroupPage() {
  const [code, setCode] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function create() {
    setMsg("");
    const r = await fetch("/api/group/create", { method:"POST" });
    const js = await r.json();
    if (js.ok) setCreated(js.code);
    else setMsg(js.error || "Fel");
  }
  async function join() {
    setMsg("");
    const r = await fetch(`/api/group/join?code=${encodeURIComponent(code)}`, { method:"POST" });
    const js = await r.json();
    if (!js.ok) setMsg(js.message || js.error || "Fel");
    else setCreated(js.code);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Grupp</h1>
      <button onClick={create} className="border rounded-md px-4 py-2">Skapa grupp</button>

      <div className="pt-4">
        <div className="text-sm mb-2">Gå med i grupp</div>
        <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())}
               placeholder="KOD6" className="border rounded-md p-2 w-full" />
        <button onClick={join} className="border rounded-md px-4 py-2 mt-2">Gå med</button>
      </div>

      {created && (
        <div className="text-sm">
          Gruppkod: <b>{created}</b> — <a className="underline" href={`/group/recs-test?code=${created}`}>visa rekommendationer</a>
        </div>
      )}
      {msg && <div className="text-sm text-red-400">{msg}</div>}
    </div>
  );
}
