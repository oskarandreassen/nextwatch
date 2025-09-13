"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const GENRES = ["Action","Äventyr","Komedí","Kriminal","Drama","Fantasy","Skräck","Romantik","Sci-Fi","Thriller"];

export default function OnboardingPage() {
  const r = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [region, setRegion] = useState("SE");
  const [uiLanguage, setUiLanguage] = useState("sv");
  const [providers, setProviders] = useState<string>("Netflix");
  const [dob, setDob] = useState("2000-01-01");
  const [favoriteMovie, setFavoriteMovie] = useState("");
  const [favoriteShow, setFavoriteShow] = useState("");
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/profile/status", { cache: "no-store" }).then((r) => r.json());
      if (!s?.ok) return;
      if (!s.emailVerified) r.push("/auth/signup");
    })();
  }, [r]);

  const toggleGenre = (list: string[], setList: (v: string[]) => void, g: string) => {
    setList(list.includes(g) ? list.filter((x) => x !== g) : [...list, g]);
  };

  const save = async () => {
    setErr(null);
    const pv = providers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/profile/save-onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName,
        region,
        uiLanguage,
        providers: pv,
        dob,
        favoriteMovie,
        favoriteShow,
        favoriteGenres,
        dislikedGenres,
      }),
    });
    const d = await res.json().catch(() => null);
    if (d?.ok) r.push("/swipe");
    else setErr(d?.error || "Kunde inte spara.");
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Onboarding</h1>

      {step === 1 && (
        <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div>
            <div className="mb-1 text-sm text-neutral-300">Namn</div>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <div className="mb-1 text-sm text-neutral-300">Region</div>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none">
                <option value="SE">SE – Sverige</option>
                <option value="NO">NO – Norge</option>
                <option value="DK">DK – Danmark</option>
                <option value="FI">FI – Finland</option>
                <option value="US">US – USA</option>
              </select>
            </label>
            <label>
              <div className="mb-1 text-sm text-neutral-300">Språk</div>
              <select value={uiLanguage} onChange={(e) => setUiLanguage(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none">
                <option value="sv">sv-SE</option>
                <option value="en">en-US</option>
                <option value="no">nb-NO</option>
                <option value="da">da-DK</option>
                <option value="fi">fi-FI</option>
              </select>
            </label>
          </div>
          <div>
            <div className="mb-1 text-sm text-neutral-300">Födelsedatum</div>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none" />
          </div>
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900">Nästa</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div>
            <div className="mb-1 text-sm text-neutral-300">Streaming­tjänster (komma­separerat)</div>
            <input value={providers} onChange={(e) => setProviders(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none" />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="rounded-md border border-neutral-700 px-3 py-2 text-neutral-200">Tillbaka</button>
            <button onClick={() => setStep(3)} className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900">Nästa</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div>
            <div className="mb-1 text-sm text-neutral-300">Favoritfilm</div>
            <input value={favoriteMovie} onChange={(e) => setFavoriteMovie(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none" />
          </div>
          <div>
            <div className="mb-1 text-sm text-neutral-300">Favoritserie</div>
            <input value={favoriteShow} onChange={(e) => setFavoriteShow(e.target.value)} className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none" />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="rounded-md border border-neutral-700 px-3 py-2 text-neutral-200">Tillbaka</button>
            <button onClick={() => setStep(4)} className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900">Nästa</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-1 text-sm text-neutral-300">Favoritgenrer (välj flera)</div>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button key={g} onClick={() => toggleGenre(favoriteGenres, setFavoriteGenres, g)} className={`rounded-full border px-3 py-1 text-sm ${favoriteGenres.includes(g) ? "border-white bg-white text-neutral-900" : "border-neutral-700 text-neutral-200"}`}>
                {g}
              </button>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="rounded-md border border-neutral-700 px-3 py-2 text-neutral-200">Tillbaka</button>
            <button onClick={() => setStep(5)} className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900">Nästa</button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-1 text-sm text-neutral-300">Undvik genrer</div>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button key={g} onClick={() => toggleGenre(dislikedGenres, setDislikedGenres, g)} className={`rounded-full border px-3 py-1 text-sm ${dislikedGenres.includes(g) ? "border-white bg-white text-neutral-900" : "border-neutral-700 text-neutral-200"}`}>
                {g}
              </button>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(4)} className="rounded-md border border-neutral-700 px-3 py-2 text-neutral-200">Tillbaka</button>
            <button onClick={() => setStep(6)} className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900">Nästa</button>
          </div>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-neutral-200">Klart! Vi sparar din profil och skräddarsyr rekommendationer.</div>
          {err && <div className="text-sm text-red-400">{err}</div>}
          <div className="flex justify-between">
            <button onClick={() => setStep(5)} className="rounded-md border border-neutral-700 px-3 py-2 text-neutral-200">Tillbaka</button>
            <button onClick={save} className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900">Spara & börja</button>
          </div>
        </section>
      )}
    </main>
  );
}
