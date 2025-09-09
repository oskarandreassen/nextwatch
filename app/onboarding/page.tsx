"use client";

import { useEffect, useState } from "react";

const ALL = ["Netflix","Disney+","Max","Amazon Prime Video","Viaplay","Apple TV+","TV4 Play","SVT Play"];

export default function Onboarding() {
  const [dob, setDob] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch("/api/session/init").catch(()=>{}); }, []);

  const toggle = (p: string) =>
    setProviders((prev) => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);

  async function save() {
    setMsg("");
    const r = await fetch("/api/profile", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ dob, providers, uiLanguage:"sv", yearPreference:"all", region:"SE", locale:"sv-SE" })
    });
    const js = await r.json();
    setMsg(js.ok ? "Sparat! (Testa gärna /recs-test när den är på plats)" : `Fel: ${js.error||"okänt"}`);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Onboarding</h1>
      <label className="block">
        <span className="text-sm">Födelsedatum (YYYY-MM-DD)</span>
        <input className="mt-1 w-full border rounded-md p-2"
               value={dob} onChange={e=>setDob(e.target.value)} placeholder="2001-05-10" />
      </label>

      <div>
        <div className="text-sm mb-2">Välj dina streamingtjänster</div>
        <div className="grid grid-cols-2 gap-2">
          {ALL.map(p => (
            <button key={p} onClick={()=>toggle(p)}
              className={`border rounded-md p-2 text-left ${providers.includes(p) ? "bg-black text-white" : ""}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <button onClick={save} className="px-4 py-2 border rounded-md">Spara profil</button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
