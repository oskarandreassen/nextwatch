// app/profile/ProfileClient.tsx
'use client';

import { useEffect, useState } from 'react';

type Profile = {
  displayName: string;
  dob?: string; // ISO yyyy-mm-dd
  favoriteGenres: string[];
  dislikedGenres: string[];
  providers: string[]; // ex 'Netflix', 'Disney Plus'
  uiLanguage: string;  // ex 'sv', 'en'
};

type SaveResp = { ok: boolean; message?: string };

// Tillåt null i initial-props (matchar ProfileDTO från serversidan)
type InitialProfile = {
  displayName?: string | null;
  dob?: string | null;
  favoriteGenres?: string[] | null;
  dislikedGenres?: string[] | null;
  providers?: string[] | null;
  uiLanguage?: string | null;
} | null;

const ALL_LANGS: { code: string; label: string }[] = [
  { code: 'sv', label: 'Svenska' },
  { code: 'en', label: 'English' },
];

const ALL_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance',
  'Science Fiction', 'TV Movie', 'Thriller', 'War', 'Western'
] as const;

const ALL_PROVIDERS = [
  'Netflix', 'Disney Plus', 'HBO Max', 'Amazon Prime Video', 'Viaplay', 'Apple TV Plus', 'SkyShowtime'
] as const;

async function loadProfile(): Promise<Partial<Profile>> {
  const res = await fetch('/api/profile/get', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load profile');
  return (await res.json()) as Partial<Profile>;
}

async function saveProfile(p: Profile): Promise<SaveResp> {
  const res = await fetch('/api/profile/save-onboarding', {
    method: 'POST',
    body: JSON.stringify({
      displayName: p.displayName,
      dob: p.dob,
      favoriteGenres: p.favoriteGenres,
      dislikedGenres: p.dislikedGenres,
      providers: p.providers,
      uiLanguage: p.uiLanguage,
      // Region & Locale skickas inte – servern härleder från cookies/IP
    }),
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    // Försök läsa serverns felmeddelande, annars generiskt
    let message = 'Ett fel uppstod.';
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }

  return (await res.json()) as SaveResp;
}

export default function ProfileClient({ initial }: { initial?: InitialProfile }) {
  // Normalisera null/undefined till säkra standardvärden
  const [p, setP] = useState<Profile>(() => ({
    displayName: initial?.displayName ?? '',
    dob: initial?.dob ?? '',
    favoriteGenres: Array.isArray(initial?.favoriteGenres) ? initial.favoriteGenres! : [],
    dislikedGenres: Array.isArray(initial?.dislikedGenres) ? initial.dislikedGenres! : [],
    providers: Array.isArray(initial?.providers) ? initial.providers! : [],
    uiLanguage: initial?.uiLanguage ?? 'sv',
  }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Hämta färsk profil (om serversidan fyller på andra fält)
  useEffect(() => {
    (async () => {
      try {
        const data = await loadProfile();
        setP((old) => ({
          displayName: (data.displayName ?? old.displayName) ?? '',
          dob: (data.dob ?? old.dob) ?? '',
          favoriteGenres: Array.isArray(data.favoriteGenres) ? data.favoriteGenres : old.favoriteGenres,
          dislikedGenres: Array.isArray(data.dislikedGenres) ? data.dislikedGenres : old.dislikedGenres,
          providers: Array.isArray(data.providers) ? data.providers : old.providers,
          uiLanguage: (data.uiLanguage ?? old.uiLanguage) ?? 'sv',
        }));
      } catch {
        // noop – behåll initialt värde
      }
    })();
  }, []);

  const toggle = (key: 'favoriteGenres' | 'dislikedGenres' | 'providers', value: string) => {
    setP((old) => {
      const has = old[key].includes(value);
      const next = has ? old[key].filter((v) => v !== value) : [...old[key], value];
      return { ...old, [key]: next };
    });
  };

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const result = await saveProfile(p);
      setMsg(result.ok ? 'Profil uppdaterad!' : (result.message ?? 'Ett fel uppstod.'));
    } catch {
      setMsg('Ett fel uppstod.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Profil</h1>

      {/* Kort / sektioner i onboarding-stil */}
      <section className="mb-5 rounded-2xl bg-neutral-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Ditt namn</h2>
        <input
          type="text"
          value={p.displayName}
          onChange={(e) => setP({ ...p, displayName: e.target.value })}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-violet-600"
          placeholder="Visningsnamn"
        />
      </section>

      <section className="mb-5 rounded-2xl bg-neutral-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Födelsedatum</h2>
        <input
          type="date"
          value={p.dob ?? ''}
          onChange={(e) => setP({ ...p, dob: e.target.value })}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-violet-600"
        />
        <p className="mt-2 text-xs text-neutral-400">Format: ÅÅÅÅ-MM-DD</p>
      </section>

      <section className="mb-5 rounded-2xl bg-neutral-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Favoritgenrer</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map((g) => {
            const active = p.favoriteGenres.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggle('favoriteGenres', g)}
                className={`rounded-full px-3 py-1 text-sm transition
                  ${active ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}
                `}
              >
                {g}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-5 rounded-2xl bg-neutral-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Undvik genrer</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map((g) => {
            const active = p.dislikedGenres.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggle('dislikedGenres', g)}
                className={`rounded-full px-3 py-1 text-sm transition
                  ${active ? 'bg-rose-600 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}
                `}
              >
                {g}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-5 rounded-2xl bg-neutral-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">Tjänster du har</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_PROVIDERS.map((v) => {
            const active = p.providers.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggle('providers', v)}
                className={`rounded-full px-3 py-1 text-sm transition
                  ${active ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}
                `}
              >
                {v}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6 rounded-2xl bg-neutral-900 p-5">
        <h2 className="mb-3 text-lg font-semibold">UI-språk</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGS.map((lang) => {
            const active = p.uiLanguage === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setP({ ...p, uiLanguage: lang.code })}
                className={`rounded-full px-3 py-1 text-sm transition
                  ${active ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}
                `}
                aria-pressed={active}
              >
                {lang.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Region &amp; Locale sätts automatiskt (cookies/IP) och visas inte här.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-xl bg-violet-600 px-4 py-2 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Spara ändringar
        </button>
        {msg && <p className="text-sm text-neutral-300">{msg}</p>}
      </div>
    </main>
  );
}
