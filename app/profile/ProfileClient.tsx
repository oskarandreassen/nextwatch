// app/profile/ProfileClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

export type FavoriteItem = {
  id: number;
  title: string;
  year?: string | null;
  poster?: string | null;
};

// Tillåt undefined här så den matchar serverns (page.tsx) DTO exakt.
export type ProfileDTO = {
  displayName: string | null;
  dob: string | null;            // ISO yyyy-mm-dd
  region: string | null;
  locale: string | null;
  uiLanguage: string | null;     // 'sv' | 'en' | ...
  favoriteGenres: string[];
  favoriteMovie?: FavoriteItem | null; // <- optional
  favoriteShow?: FavoriteItem | null;  // <- optional
};

type Props = {
  initial: ProfileDTO | null;
};

type Fav = FavoriteItem | null;

const ALL_LANGS: { code: string; label: string }[] = [
  { code: 'sv', label: 'Svenska' },
  { code: 'en', label: 'English' },
];

const ALL_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance',
  'Science Fiction', 'TV Movie', 'Thriller', 'War', 'Western'
] as const;

const PROVIDERS = [
  { id: 'netflix', label: 'Netflix' },
  { id: 'disney-plus', label: 'Disney+' },
  { id: 'prime-video', label: 'Prime Video' },
  { id: 'max', label: 'Max' },
  { id: 'viaplay', label: 'Viaplay' },
  { id: 'apple-tv-plus', label: 'Apple TV+' },
  { id: 'skyshowtime', label: 'SkyShowtime' },
  { id: 'svt-play', label: 'SVT Play' },
  { id: 'tv4-play', label: 'TV4 Play' },
] as const;

function toInputDate(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ');
}

// ——— Tiny TMDB search box ———
type SearchItem = { id: number; title: string; year?: string | null; poster?: string | null };
type SearchRes = { ok: boolean; items: SearchItem[] };

function SearchBox({
  label,
  placeholder,
  type,
  value,
  onSelect,
  locale = 'sv-SE',
}: {
  label: string;
  placeholder: string;
  type: 'movie' | 'tv';
  value: Fav;
  onSelect: (v: Fav) => void;
  locale?: string;
}) {
  const [q, setQ] = useState<string>('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    if (!q || value) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const url = `/api/tmdb/search?q=${encodeURIComponent(q)}&type=${type}&locale=${encodeURIComponent(locale)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as SearchRes;
        if (!active) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setOpen(true);
      } catch { /* ignore */ }
    }, 200);
    return () => { active = false; clearTimeout(t); };
  }, [q, type, locale, value]);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <label className="mb-1 block text-sm text-white/70">{label}</label>
      <div className="flex gap-2">
        <input
          className="mt-0 w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none focus:ring-2 focus:ring-white/20"
          placeholder={placeholder}
          value={value ? value.title : q}
          onChange={(e) => { onSelect(null); setQ(e.target.value); }}
        />
        {value && (
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-black/30 px-3 text-sm hover:bg-white/5"
            onClick={() => onSelect(null)}
            aria-label="Rensa"
            title="Rensa"
          >
            ✕
          </button>
        )}
      </div>

      {open && items.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-black/80 backdrop-blur">
          <ul className="max-h-64 overflow-auto">
            {items.map((it) => (
              <li key={`${type}-${it.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-2 text-left hover:bg-white/5"
                  onClick={() => { onSelect({ id: it.id, title: it.title, year: it.year ?? null, poster: it.poster ?? null }); setQ(''); setOpen(false); }}
                >
                  <div className="h-12 w-8 overflow-hidden rounded bg-white/10">
                    {it.poster ? (
                      <Image src={it.poster} alt="" width={80} height={120} className="h-12 w-8 object-cover" />
                    ) : (<div className="h-12 w-8" />)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm">{it.title}</div>
                    {it.year && <div className="text-xs text-white/60">{it.year}</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ProfileClient({ initial }: Props) {
  const [displayName, setDisplayName]   = useState<string>(initial?.displayName ?? '');
  const [dob, setDob]                   = useState<string>(toInputDate(initial?.dob ?? null));
  const [uiLanguage, setUiLanguage]     = useState<string>(initial?.uiLanguage ?? 'sv');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(initial?.favoriteGenres ?? []);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [providers, setProviders]           = useState<string[]>([]);
  const [favoriteMovie, setFavoriteMovie]   = useState<Fav>(initial?.favoriteMovie ?? null);
  const [favoriteShow, setFavoriteShow]     = useState<Fav>(initial?.favoriteShow ?? null);
  const [busy, setBusy] = useState<boolean>(false);
  const [msg, setMsg]   = useState<string | null>(null);

  // Hydrate (om initial saknar vissa fält)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; profile?: Record<string, unknown> };
        if (!data.ok || !data.profile || ignore) return;
        const p = data.profile as Record<string, unknown>;
        setDislikedGenres((Array.isArray(p.dislikedGenres) ? p.dislikedGenres : []).filter((s): s is string => typeof s === 'string'));
        setProviders((Array.isArray(p.providers) ? p.providers : []).filter((s): s is string => typeof s === 'string'));
        if (typeof p.uiLanguage === 'string') setUiLanguage(p.uiLanguage);
        if (typeof p.displayName === 'string') setDisplayName(p.displayName);
        if (typeof p.dob === 'string') setDob(toInputDate(p.dob));
        if (p.favoriteMovie && typeof p.favoriteMovie === 'object') {
          const o = p.favoriteMovie as Record<string, unknown>;
          const id = typeof o.id === 'number' ? o.id : null;
          const title = typeof o.title === 'string' ? o.title : null;
          if (id && title) setFavoriteMovie({ id, title, year: typeof o.year === 'string' ? o.year : null, poster: typeof o.poster === 'string' ? o.poster : null });
        }
        if (p.favoriteShow && typeof p.favoriteShow === 'object') {
          const o = p.favoriteShow as Record<string, unknown>;
          const id = typeof o.id === 'number' ? o.id : null;
          const title = typeof o.title === 'string' ? o.title : null;
          if (id && title) setFavoriteShow({ id, title, year: typeof o.year === 'string' ? o.year : null, poster: typeof o.poster === 'string' ? o.poster : null });
        }
      } catch { /* noop */ }
    })();
    return () => { ignore = true; };
  }, []);

  const toggle = (key: 'favoriteGenres' | 'dislikedGenres' | 'providers', value: string) => {
    if (key === 'favoriteGenres') setFavoriteGenres((old) => (old.includes(value) ? old.filter((v) => v !== value) : [...old, value]));
    else if (key === 'dislikedGenres') setDislikedGenres((old) => (old.includes(value) ? old.filter((v) => v !== value) : [...old, value]));
    else setProviders((old) => (old.includes(value) ? old.filter((v) => v !== value) : [...old, value]));
  };

  const canSubmit = useMemo(() => !!displayName && !!dob, [displayName, dob]);

  const submit = async () => {
    if (!canSubmit) { setMsg('Fyll i namn och födelsedatum.'); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/profile/save-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ displayName, dob, uiLanguage, favoriteGenres, dislikedGenres, providers, favoriteMovie, favoriteShow }),
      });
      let message = 'Sparat.';
      if (!res.ok) {
        try { const d = (await res.json()) as { message?: string }; if (d?.message) message = d.message; } catch {}
        setMsg(message);
      } else {
        try { const d = (await res.json()) as { message?: string }; if (d?.message) message = d.message; } catch {}
        setMsg(message);
      }
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Ett fel uppstod.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Din profil</h1>

      <div className="grid gap-5">
        {/* Namn & DOB */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-white/70">Visningsnamn</label>
            <input className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none focus:ring-2 focus:ring-white/20" placeholder="Ditt namn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">Födelsedatum</label>
            <input type="date" className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none focus:ring-2 focus:ring-white/20" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
        </div>

        {/* Favoriter */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchBox label="Favoritfilm" placeholder="Sök film…" type="movie" value={favoriteMovie} onSelect={setFavoriteMovie} />
          <SearchBox label="Favoritserie" placeholder="Sök serie…" type="tv" value={favoriteShow} onSelect={setFavoriteShow} />
        </div>

        {/* UI-språk */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-white/70">UI-språk</label>
            <div className="flex flex-wrap gap-2">
              {ALL_LANGS.map((l) => (
                <button key={l.code} type="button" onClick={() => setUiLanguage(l.code)}
                  className={classNames('rounded-xl border px-3 py-2 text-sm', uiLanguage === l.code ? 'border-violet-500 bg-violet-600/20' : 'border-white/10 bg-black/30 hover:bg-white/5')}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Genrer */}
        <div>
          <label className="mb-2 block text-sm text-white/70">Gillar genrer</label>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES.map((g) => (
              <button type="button" key={`like-${g}`} onClick={() => toggle('favoriteGenres', g)}
                className={classNames('rounded-xl border px-3 py-2 text-sm', favoriteGenres.includes(g) ? 'border-emerald-500 bg-emerald-600/20' : 'border-white/10 bg-black/30 hover:bg-white/5')}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-white/70">Undvik genrer</label>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES.map((g) => (
              <button type="button" key={`dislike-${g}`} onClick={() => toggle('dislikedGenres', g)}
                className={classNames('rounded-xl border px-3 py-2 text-sm', dislikedGenres.includes(g) ? 'border-rose-500 bg-rose-600/20' : 'border-white/10 bg-black/30 hover:bg-white/5')}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Providers */}
        <div>
          <label className="mb-2 block text-sm text-white/70">Tjänster du har</label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button type="button" key={p.id} onClick={() => toggle('providers', p.id)}
                className={classNames('rounded-xl border px-3 py-2 text-sm', providers.includes(p.id) ? 'border-sky-500 bg-sky-600/20' : 'border-white/10 bg-black/30 hover:bg-white/5')}
                title={p.label} aria-label={p.label}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={busy || !canSubmit} className="rounded-xl bg-violet-600 px-4 py-2 text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60">
            Spara ändringar
          </button>
          {msg && <p className="text-sm text-neutral-300">{msg}</p>}
        </div>
      </div>
    </main>
  );
}
