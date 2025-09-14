// app/onboarding/page_client.tsx
"use client";

import { useMemo, useState } from "react";
import TitleTypeahead, { PickedTitle } from "../components/onboarding/TitleTypeahead";
import ProviderPicker from "../components/onboarding/ProviderPicker";

interface Payload {
  displayName?: string;
  dobISO: string;
  uiLanguage: string;
  region: string;
  locale: string;
  providers: string[];
  favoriteMovie?: PickedTitle | null;
  favoriteShow?: PickedTitle | null;
  favoriteGenres: string[];
  dislikedGenres: string[];
}

const ALL_GENRES = [
  "Action","Äventyr","Animerat","Komedi","Kriminal","Drama","Fantasy","Skräck","Romantik","Sci-Fi","Thriller","Dokumentär",
];

export default function OnboardingClient() {
  const [displayName, setDisplayName] = useState("");
  const [dobISO, setDobISO] = useState("2001-01-01");
  const [uiLanguage, setUiLanguage] = useState("sv");
  const [region, setRegion] = useState("SE");
  const [locale, setLocale] = useState("sv-SE");
  const [providers, setProviders] = useState<string[]>([]);
  const [favoriteMovie, setFavoriteMovie] = useState<PickedTitle | null>(null);
  const [favoriteShow, setFavoriteShow] = useState<PickedTitle | null>(null);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(list: string[], setList: (v: string[]) => void, g: string) {
    const s = new Set(list);
    s.has(g) ? s.delete(g) : s.add(g);
    setList(Array.from(s));
  }

  const canSave = useMemo(() => !!dobISO && !!region && !!locale, [dobISO, region, locale]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const body: Payload = {
      displayName: displayName || undefined,
      dobISO, uiLanguage, region, locale,
      providers,
      favoriteMovie,
      favoriteShow,
      favoriteGenres,
      dislikedGenres,
    };

    const res = await fetch("/api/profile/save-onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMsg("Klart! Vi sparar din profil och skräddarsyr rekommendationer.");
      location.href = "/swipe";
    } else {
      const d = await res.json().catch(() => null);
      setMsg(d?.error ?? "Ett fel uppstod.");
    }
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
      {msg && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-red-300">
          {msg}
        </div>
      )}

      <div className="grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Visningsnamn</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-neutral-500"
              placeholder="Ditt namn"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1">Födelsedatum</label>
            <input
              type="date"
              value={dobISO}
              onChange={(e) => setDobISO(e.target.value)}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-neutral-500"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Select label="Språk" value={uiLanguage} onChange={setUiLanguage} options={["sv","en"]} />
          <Select label="Region" value={region} onChange={setRegion} options={["SE","NO","DK","FI"]} />
          <Select label="Locale" value={locale} onChange={setLocale} options={["sv-SE","en-US"]} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TitleTypeahead
            type="movie"
            label="Favoritfilm"
            value={favoriteMovie ?? undefined}
            onChange={setFavoriteMovie}
            language={locale}
            region={region}
          />
          <TitleTypeahead
            type="tv"
            label="Favoritserie"
            value={favoriteShow ?? undefined}
            onChange={setFavoriteShow}
            language={locale}
            region={region}
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-2">Streaming­tjänster</label>
          <ProviderPicker value={providers} onChange={setProviders} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <GenreBox
            title="Gillar"
            options={ALL_GENRES}
            value={favoriteGenres}
            onToggle={(g) => toggle(favoriteGenres, setFavoriteGenres, g)}
          />
          <GenreBox
            title="Ogillar"
            options={ALL_GENRES}
            value={dislikedGenres}
            onToggle={(g) => toggle(dislikedGenres, setDislikedGenres, g)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => history.back()}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
          >
            Tillbaka
          </button>
          <button
            disabled={!canSave || saving}
            onClick={save}
            className="rounded-lg bg-white text-black px-4 py-2 disabled:opacity-50"
          >
            {saving ? "Sparar…" : "Spara & börja"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-sm text-neutral-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-neutral-500"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function GenreBox({
  title, options, value, onToggle,
}: { title: string; options: string[]; value: string[]; onToggle: (g: string) => void }) {
  const set = new Set(value);
  return (
    <div>
      <div className="text-sm text-neutral-400 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(g => {
          const active = set.has(g);
          return (
            <button
              type="button"
              key={g}
              onClick={() => onToggle(g)}
              className={`px-3 py-1.5 rounded-full text-sm border ${active ? "border-neutral-300 bg-neutral-800" : "border-neutral-700 hover:bg-neutral-900"}`}
              aria-pressed={active}
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}
