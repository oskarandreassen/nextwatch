"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type FavoriteTitle = {
  id: number;
  title: string;
  year?: string;
  poster?: string | null;
};

type Profile = {
  userId: string;
  displayName: string | null;
  region: string;
  locale: string;
  uiLanguage: string;
  providers: unknown;            // stored as JSON in DB
  favoriteMovie: unknown;        // JSON
  favoriteShow: unknown;         // JSON
  favoriteGenres: string[];
  dislikedGenres: string[];
  dob: string;                   // ISO date
};

type SearchItem = FavoriteTitle;
type SearchRes = { ok: boolean; items: SearchItem[] };

const REGIONS = ["SE", "NO", "DK", "FI", "US", "GB", "DE", "NL", "FR", "ES", "IT"];
const LOCALES = ["sv-SE", "nb-NO", "da-DK", "fi-FI", "en-US", "en-GB", "de-DE", "nl-NL", "fr-FR", "es-ES", "it-IT"];
const LANGS = ["sv", "en", "no", "da", "fi", "de", "fr", "es", "it"];

const PROVIDERS: { id: string; name: string; logo?: string }[] = [
  { id: "netflix", name: "Netflix", logo: "/providers/netflix.svg" },
  { id: "disney-plus", name: "Disney+", logo: "/providers/disney-plus.svg" },
  { id: "prime-video", name: "Prime Video", logo: "/providers/prime-video.svg" },
  { id: "max", name: "Max", logo: "/providers/max.svg" },
  { id: "viaplay", name: "Viaplay", logo: "/providers/viaplay.svg" },
  { id: "apple-tv-plus", name: "Apple TV+", logo: "/providers/apple-tv-plus.svg" },
  { id: "skyshowtime", name: "SkyShowtime", logo: "/providers/skyshowtime.svg" },
  { id: "svt-play", name: "SVT Play", logo: "/providers/svt-play.svg" },
  { id: "tv4-play", name: "TV4 Play", logo: "/providers/tv4-play.svg" },
];

const GENRES_SV = [
  "Action","Äventyr","Animerat","Komedi","Kriminal","Dokumentär",
  "Drama","Fantasy","Skräck","Romantik","Sci-Fi","Thriller",
  "Mysterium","Familj","Historia","Musik","Krig","Western"
];

function isFav(v: unknown): v is FavoriteTitle {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "number" && typeof o.title === "string";
}
function asStringArray(jsonish: unknown): string[] {
  if (Array.isArray(jsonish)) {
    return jsonish.map((x) => String(x)).filter(Boolean);
  }
  return [];
}
function asProviders(jsonish: unknown): string[] {
  if (Array.isArray(jsonish)) {
    return jsonish
      .map((x) => (typeof x === "string" ? x : typeof x === "number" ? String(x) : null))
      .filter((v): v is string => v !== null);
  }
  return [];
}

function useDebounced(value: string, ms: number) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return deb;
}

export default function ProfileClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // fields
  const [displayName, setDisplayName] = useState("");
  const [region, setRegion] = useState("SE");
  const [locale, setLocale] = useState("sv-SE");
  const [uiLanguage, setUiLanguage] = useState("sv");
  const [providers, setProviders] = useState<string[]>([]);
  const [favoriteMovie, setFavoriteMovie] = useState<FavoriteTitle | null>(null);
  const [favoriteShow, setFavoriteShow] = useState<FavoriteTitle | null>(null);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [dob, setDob] = useState("2001-01-01");

  // search state
  const [movieQuery, setMovieQuery] = useState("");
  const [showQuery, setShowQuery] = useState("");
  const debMovieQ = useDebounced(movieQuery, 250);
  const debShowQ = useDebounced(showQuery, 250);
  const [movieHits, setMovieHits] = useState<SearchItem[]>([]);
  const [showHits, setShowHits] = useState<SearchItem[]>([]);
  const movieOpenRef = useRef(false);
  const showOpenRef = useRef(false);

  useEffect(() => {
    let mount = true;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/profile/me", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; profile?: Profile };
      if (mount && data.ok && data.profile) {
        const p = data.profile;
        setDisplayName(p.displayName ?? "");
        setRegion(p.region ?? "SE");
        setLocale(p.locale ?? "sv-SE");
        setUiLanguage(p.uiLanguage ?? "sv");
        setProviders(asProviders(p.providers));
        setFavoriteMovie(isFav(p.favoriteMovie) ? p.favoriteMovie : null);
        setFavoriteShow(isFav(p.favoriteShow) ? p.favoriteShow : null);
        setFavoriteGenres(asStringArray(p.favoriteGenres));
        setDislikedGenres(asStringArray(p.dislikedGenres));
        setDob(typeof p.dob === "string" ? p.dob.slice(0, 10) : "2001-01-01");
      }
      setLoading(false);
    })();
    return () => {
      mount = false;
    };
  }, []);

  // search calls
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!debMovieQ) { setMovieHits([]); return; }
      const r = await fetch(`/api/tmdb/search?q=${encodeURIComponent(debMovieQ)}&type=movie`);
      const j = (await r.json()) as SearchRes;
      if (mounted && j.ok) setMovieHits(j.items);
    })();
    return () => { mounted = false; };
  }, [debMovieQ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!debShowQ) { setShowHits([]); return; }
      const r = await fetch(`/api/tmdb/search?q=${encodeURIComponent(debShowQ)}&type=tv`);
      const j = (await r.json()) as SearchRes;
      if (mounted && j.ok) setShowHits(j.items);
    })();
    return () => { mounted = false; };
  }, [debShowQ]);

  const toggleProvider = (id: string) => {
    setProviders((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleGenre = (g: string, which: "fav" | "dis") => {
    if (which === "fav") {
      setFavoriteGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
      // ensure it’s removed from disliked if moved
      setDislikedGenres((prev) => prev.filter((x) => x !== g));
    } else {
      setDislikedGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
      setFavoriteGenres((prev) => prev.filter((x) => x !== g));
    }
  };

  const canSave = useMemo(() => {
    return !!displayName && !!region && !!locale && !!uiLanguage && !!dob;
  }, [displayName, region, locale, uiLanguage, dob]);

  async function onSave() {
    try {
      setSaving(true);
      setError(null);
      setOkMsg(null);

      const body = {
        displayName,
        dob,
        region,
        locale,
        uiLanguage,
        providers,
        favoriteMovie,
        favoriteShow,
        favoriteGenres,
        dislikedGenres,
      };

      const res = await fetch("/api/profile/save-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok: boolean; message?: string };
      if (!j.ok) throw new Error(j.message || "Kunde inte spara.");
      setOkMsg("Sparat! Dina rekommendationer uppdateras nu.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ett fel uppstod.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Profil</h1>

      {error && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      {okMsg && <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{okMsg}</div>}

      <div className="grid gap-5 rounded-2xl border border-white/10 bg-neutral-900/60 p-4 md:p-6">
        {/* Row: Region / Locale / UI-språk */}
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-white/70">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">Locale</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">UI-språk</label>
            <select
              value={uiLanguage}
              onChange={(e) => setUiLanguage(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* displayname + dob */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-white/70">Visningsnamn</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
              placeholder="Ditt namn…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70">Födelsedatum</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            />
          </div>
        </div>

        {/* Providers */}
        <div>
          <div className="mb-2 text-sm text-white/70">Streaming­tjänster</div>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => {
              const active = providers.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProvider(p.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    active ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-black/30 hover:bg-black/50"
                  }`}
                >
                  {p.logo ? (
                    <Image src={p.logo} alt={p.name} width={18} height={18} />
                  ) : (
                    <span className="inline-block size-4 rounded bg-white/30" />
                  )}
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Favorite movie / show with autocomplete */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* movie */}
          <div className="relative">
            <label className="mb-1 block text-sm text-white/70">Favoritfilm</label>
            <input
              value={favoriteMovie ? favoriteMovie.title : movieQuery}
              onChange={(e) => { setFavoriteMovie(null); setMovieQuery(e.target.value); }}
              onFocus={() => (movieOpenRef.current = true)}
              onBlur={() => { setTimeout(() => (movieOpenRef.current = false), 150); }}
              placeholder="Sök titel…"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            />
            {movieOpenRef.current && movieHits.length > 0 && !favoriteMovie && (
              <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-white/10 bg-neutral-900/95 p-2 backdrop-blur">
                {movieHits.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setFavoriteMovie(m); setMovieQuery(""); }}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/5"
                  >
                    {m.poster ? (
                      <Image src={m.poster} alt={m.title} width={36} height={54} className="rounded" />
                    ) : (
                      <div className="h-[54px] w-[36px] rounded bg-white/10" />
                    )}
                    <div className="text-sm">
                      <div className="font-medium">{m.title}</div>
                      <div className="text-white/60">{m.year ?? ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* show */}
          <div className="relative">
            <label className="mb-1 block text-sm text-white/70">Favoritserie</label>
            <input
              value={favoriteShow ? favoriteShow.title : showQuery}
              onChange={(e) => { setFavoriteShow(null); setShowQuery(e.target.value); }}
              onFocus={() => (showOpenRef.current = true)}
              onBlur={() => { setTimeout(() => (showOpenRef.current = false), 150); }}
              placeholder="Sök titel…"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 outline-none"
            />
            {showOpenRef.current && showHits.length > 0 && !favoriteShow && (
              <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-white/10 bg-neutral-900/95 p-2 backdrop-blur">
                {showHits.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setFavoriteShow(t); setShowQuery(""); }}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/5"
                  >
                    {t.poster ? (
                      <Image src={t.poster} alt={t.title} width={36} height={54} className="rounded" />
                    ) : (
                      <div className="h-[54px] w-[36px] rounded bg-white/10" />
                    )}
                    <div className="text-sm">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-white/60">{t.year ?? ""}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Genres: like/dislike */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm text-white/70">Gillar</div>
            <div className="flex flex-wrap gap-2">
              {GENRES_SV.map((g) => {
                const active = favoriteGenres.includes(g);
                return (
                  <button
                    key={`fav-${g}`}
                    type="button"
                    onClick={() => toggleGenre(g, "fav")}
                    className={`rounded-full px-3 py-1 text-sm transition ${
                      active ? "border border-emerald-500/40 bg-emerald-500/10" : "border border-white/10 bg-black/30 hover:bg-black/50"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm text-white/70">Ogillar</div>
            <div className="flex flex-wrap gap-2">
              {GENRES_SV.map((g) => {
                const active = dislikedGenres.includes(g);
                return (
                  <button
                    key={`dis-${g}`}
                    type="button"
                    onClick={() => toggleGenre(g, "dis")}
                    className={`rounded-full px-3 py-1 text-sm transition ${
                      active ? "border border-rose-500/40 bg-rose-500/10" : "border border-white/10 bg-black/30 hover:bg-black/50"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={onSave}
            className="rounded-xl border border-white/10 bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Sparar…" : "Spara"}
          </button>
        </div>
      </div>

      {loading && <div className="mt-4 text-sm text-white/60">Laddar…</div>}
    </div>
  );
}

import LogoutButton from "@/app/components/auth/LogoutButton";
// ...
<LogoutButton className="mt-4" />
