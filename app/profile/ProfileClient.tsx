// app/profile/ProfileClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import LogoutButton from "@/app/components/auth/LogoutButton";

export type FavoriteItem = {
  id: number;
  title: string;
  year?: string | null;
  poster?: string | null;
};

// DTO exakt som servern skickar från app/profile/page.tsx
export type ProfileDTO = {
  displayName: string | null;
  dob: string | null;
  region: string | null;
  locale: string | null;
  uiLanguage: string | null;
  favoriteGenres: string[];
  dislikedGenres?: string[];
  providers?: string[];
  favoriteMovie?: FavoriteItem | null;
  favoriteShow?: FavoriteItem | null;
};

type Props = { initial: ProfileDTO | null };
type Fav = FavoriteItem | null;

// —————————————————————— Providers ——————————————————————
const PROVIDERS = [
  { id: "netflix", label: "Netflix" },
  { id: "disney-plus", label: "Disney+" },
  { id: "prime-video", label: "Prime Video" },
  { id: "max", label: "Max" },
  { id: "viaplay", label: "Viaplay" },
  { id: "apple-tv-plus", label: "Apple TV+" },
  { id: "skyshowtime", label: "SkyShowtime" },
  { id: "svt-play", label: "SVT Play" },
  { id: "tv4-play", label: "TV4 Play" },
] as const;
type ProviderId = (typeof PROVIDERS)[number]["id"];
const LABEL_TO_ID: Record<string, ProviderId> = (() => {
  const m: Record<string, ProviderId> = {};
  const put = (k: string, v: ProviderId) => (m[k.toLowerCase()] = v);
  for (const p of PROVIDERS) put(p.label, p.id);
  put("disney plus", "disney-plus");
  put("amazon prime video", "prime-video");
  put("prime", "prime-video");
  put("hbo max", "max");
  put("appletv+", "apple-tv-plus");
  put("apple tv plus", "apple-tv-plus");
  put("svt", "svt-play");
  put("tv4", "tv4-play");
  return m;
})();
function toProviderIds(jsonish: unknown): ProviderId[] {
  if (!Array.isArray(jsonish)) return [];
  const out = new Set<ProviderId>();
  for (const raw of jsonish) {
    const s = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : null;
    if (!s) continue;
    const low = s.toLowerCase().trim();
    const id = (PROVIDERS as readonly { id: string }[]).some((p) => p.id === low)
      ? (low as ProviderId)
      : LABEL_TO_ID[low];
    if (id) out.add(id);
  }
  return Array.from(out);
}
function providerIdsToLabels(ids: ProviderId[]): string[] {
  const map = new Map(PROVIDERS.map((p) => [p.id, p.label] as const));
  return ids.map((id) => map.get(id)!).filter(Boolean);
}

// —————————————————————— Genrer ——————————————————————
const ALL_GENRES_SV = [
  "Action", "Äventyr", "Animerat", "Komedi", "Kriminal", "Dokumentär",
  "Drama", "Fantasy", "Skräck", "Romantik", "Sci-Fi", "Thriller",
  "Mysterium", "Familj", "Historia", "Musik", "Krig", "Western",
] as const;
const ENG_TO_SV: Record<string, string> = {
  "Action": "Action", "Adventure": "Äventyr", "Animation": "Animerat",
  "Comedy": "Komedi", "Crime": "Kriminal", "Documentary": "Dokumentär",
  "Drama": "Drama", "Fantasy": "Fantasy", "Horror": "Skräck",
  "Romance": "Romantik", "Science Fiction": "Sci-Fi", "Thriller": "Thriller",
  "Mystery": "Mysterium", "Family": "Familj", "History": "Historia",
  "Music": "Musik", "War": "Krig", "Western": "Western", "TV Movie": "TV-film",
};
function toSvGenres(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const v = ENG_TO_SV[raw] ?? raw;
    if (ALL_GENRES_SV.includes(v as (typeof ALL_GENRES_SV)[number])) out.push(v);
  }
  return Array.from(new Set(out));
}

function toInputDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function cx(...xs: Array<string | null | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// ——— Liten inline SearchBox (film/serie) ———
type SearchItem = { id: number; title: string; year?: string | null; poster?: string | null };
type SearchRes = { ok: boolean; items: SearchItem[] };

function SearchBox({
  label,
  placeholder,
  type,
  value,
  onSelect,
  locale = "sv-SE",
}: {
  label: string;
  placeholder: string;
  type: "movie" | "tv";
  value: Fav;
  onSelect: (v: Fav) => void;
  locale?: string;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    if (!q || value) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const u = `/api/tmdb/search?q=${encodeURIComponent(q)}&type=${type}&locale=${encodeURIComponent(locale)}`;
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SearchRes;
        if (!active) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setOpen(true);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => { active = false; clearTimeout(t); };
  }, [q, type, locale, value]);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
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
                  onClick={() => {
                    onSelect({
                      id: it.id,
                      title: it.title,
                      year: it.year ?? null,
                      poster: it.poster ?? null,
                    });
                    setQ("");
                    setOpen(false);
                  }}
                >
                  <div className="h-12 w-8 overflow-hidden rounded bg-white/10">
                    {it.poster ? (
                      <Image
                        src={it.poster}
                        alt=""
                        width={80}
                        height={120}
                        className="h-12 w-8 object-cover"
                      />
                    ) : (
                      <div className="h-12 w-8" />
                    )}
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

// —————————————————————— Huvudkomponent ——————————————————————
export default function ProfileClient({ initial }: Props) {
  const [displayName, setDisplayName] = useState<string>(initial?.displayName ?? "");
  const [dob, setDob] = useState<string>(toInputDate(initial?.dob ?? null));
  const [uiLanguage, setUiLanguage] = useState<string>(initial?.uiLanguage ?? "sv");

  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(
    initial?.favoriteGenres ? toSvGenres(initial.favoriteGenres) : []
  );
  const [dislikedGenres, setDislikedGenres] = useState<string[]>(
    initial?.dislikedGenres ? toSvGenres(initial.dislikedGenres) : []
  );
  const [providers, setProviders] = useState<ProviderId[]>(
    initial?.providers ? toProviderIds(initial.providers) : []
  );
  const [favoriteMovie, setFavoriteMovie] = useState<Fav>(initial?.favoriteMovie ?? null);
  const [favoriteShow, setFavoriteShow] = useState<Fav>(initial?.favoriteShow ?? null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Bakåtkompatibel hydrering om initial saknar fält
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; profile?: Record<string, unknown> | null };
        if (!data.ok || !data.profile || ignore) return;
        const p = data.profile as Record<string, unknown>;
        if (Array.isArray(p.favoriteGenres)) setFavoriteGenres(toSvGenres(p.favoriteGenres));
        if (Array.isArray(p.dislikedGenres)) setDislikedGenres(toSvGenres(p.dislikedGenres));
        if (Array.isArray(p.providers)) setProviders(toProviderIds(p.providers));
        if (typeof p.uiLanguage === "string") setUiLanguage(p.uiLanguage);
        if (typeof p.displayName === "string") setDisplayName(p.displayName);
        if (typeof p.dob === "string") setDob(toInputDate(p.dob));
        if (p.favoriteMovie && typeof p.favoriteMovie === "object") {
          const o = p.favoriteMovie as Record<string, unknown>;
          const id = typeof o.id === "number" ? o.id : null;
          const title = typeof o.title === "string" ? o.title : null;
          if (id && title) setFavoriteMovie({
            id, title,
            year: typeof o.year === "string" ? o.year : null,
            poster: typeof o.poster === "string" ? o.poster : null
          });
        }
        if (p.favoriteShow && typeof p.favoriteShow === "object") {
          const o = p.favoriteShow as Record<string, unknown>;
          const id = typeof o.id === "number" ? o.id : null;
          const title = typeof o.title === "string" ? o.title : null;
          if (id && title) setFavoriteShow({
            id, title,
            year: typeof o.year === "string" ? o.year : null,
            poster: typeof o.poster === "string" ? o.poster : null
          });
        }
      } catch { /* noop */ }
    })();
    return () => { ignore = true; };
  }, []);

  const canSubmit = useMemo(() => !!displayName && !!dob, [displayName, dob]);

  const submit = async () => {
    if (!canSubmit) { setMsg("Fyll i namn och födelsedatum."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/profile/save-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          displayName,
          dob,
          uiLanguage,
          favoriteGenres,
          dislikedGenres,
          providers: providerIdsToLabels(providers), // behåll kompatibilitet
          favoriteMovie,
          favoriteShow,
        }),
      });
      let message = "Sparat.";
      try {
        const d = (await res.json()) as { message?: string };
        if (d?.message) message = d.message;
      } catch {}
      setMsg(message);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Ett fel uppstod.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: "favoriteGenres" | "dislikedGenres" | "providers", value: string) => {
    if (key === "favoriteGenres") {
      setFavoriteGenres((old) => (old.includes(value) ? old.filter((v) => v !== value) : [...old, value]));
      setDislikedGenres((old) => old.filter((v) => v !== value));
    } else if (key === "dislikedGenres") {
      setDislikedGenres((old) => (old.includes(value) ? old.filter((v) => v !== value) : [...old, value]));
      setFavoriteGenres((old) => old.filter((v) => v !== value));
    } else {
      const id = value as ProviderId;
      setProviders((old) => (old.includes(id) ? old.filter((v) => v !== id) : [...old, id]));
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Din profil</h1>
        <LogoutButton />
      </div>

      <div className="grid gap-5">
        {/* Namn & DOB */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-white/70">Visningsnamn</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none focus:ring-2 focus:ring-white/20"
              placeholder="Ditt namn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">Födelsedatum</label>
            <input
              type="date"
              className="w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none focus:ring-2 focus:ring-white/20"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
        </div>

        {/* Favoriter – inline-sök */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchBox label="Favoritfilm" placeholder="Sök film…" type="movie" value={favoriteMovie} onSelect={setFavoriteMovie} />
          <SearchBox label="Favoritserie" placeholder="Sök serie…" type="tv" value={favoriteShow} onSelect={setFavoriteShow} />
        </div>

        {/* UI-språk */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-white/70">UI-språk</label>
            <div className="flex flex-wrap gap-2">
              {["sv", "en"].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setUiLanguage(code)}
                  className={cx(
                    "rounded-xl border px-3 py-2 text-sm",
                    uiLanguage === code ? "border-violet-500 bg-violet-600/20" : "border-white/10 bg-black/30 hover:bg-white/5"
                  )}
                >
                  {code === "sv" ? "Svenska" : "English"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Genrer */}
        <div>
          <label className="mb-2 block text-sm text-white/70">Gillar genrer</label>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES_SV.map((g) => (
              <button
                type="button"
                key={`like-${g}`}
                onClick={() => toggle("favoriteGenres", g)}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm",
                  favoriteGenres.includes(g) ? "border-emerald-500 bg-emerald-600/20" : "border-white/10 bg-black/30 hover:bg-white/5"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-white/70">Undvik genrer</label>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES_SV.map((g) => (
              <button
                type="button"
                key={`dislike-${g}`}
                onClick={() => toggle("dislikedGenres", g)}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm",
                  dislikedGenres.includes(g) ? "border-rose-500 bg-rose-600/20" : "border-white/10 bg-black/30 hover:bg-white/5"
                )}
              >
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
              <button
                type="button"
                key={p.id}
                onClick={() => toggle("providers", p.id)}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm",
                  providers.includes(p.id) ? "border-sky-500 bg-sky-600/20" : "border-white/10 bg-black/30 hover:bg-white/5"
                )}
                title={p.label}
                aria-label={p.label}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spara */}
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={busy || !canSubmit}
            className="rounded-xl bg-violet-600 px-4 py-2 text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Sparar…" : "Spara ändringar"}
          </button>
          {msg && <p className="text-sm text-neutral-300">{msg}</p>}
        </div>
      </div>
    </main>
  );
}
