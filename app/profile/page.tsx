// app/profile/page.tsx
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { Suspense } from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileDTO = {
  displayName: string | null;
  region: string;
  locale: string;
  uiLanguage: string;
  dob: string | null;                 // ISO yyyy-mm-dd
  providers: string[];                // id/sluggar som strängar
  favoriteMovie: Record<string, unknown> | null;
  favoriteShow: Record<string, unknown> | null;
  favoriteGenres: string[];
  dislikedGenres: string[];
};

function formatDateInput(d: Date | string | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function loadProfile(): Promise<ProfileDTO | null> {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return null;

  const p = await prisma.profile.findUnique({
    where: { userId: uid },
    select: {
      displayName: true,
      region: true,
      locale: true,
      uiLanguage: true,
      dob: true,
      providers: true,
      favoriteMovie: true,
      favoriteShow: true,
      favoriteGenres: true,
      dislikedGenres: true,
    },
  });

  if (!p) return null;

  return {
    displayName: p.displayName ?? null,
    region: p.region,
    locale: p.locale,
    uiLanguage: p.uiLanguage,
    dob: p.dob ? formatDateInput(p.dob) : null,
    providers: Array.isArray(p.providers) ? (p.providers as string[]) : [],
    favoriteMovie: (p.favoriteMovie as Record<string, unknown> | null) ?? null,
    favoriteShow: (p.favoriteShow as Record<string, unknown> | null) ?? null,
    favoriteGenres: p.favoriteGenres ?? [],
    dislikedGenres: p.dislikedGenres ?? [],
  };
}

export default async function Page() {
  const profile = await loadProfile();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Profil</h1>

      {/* Grid: bättre desktop-layout, funkar även i mobil */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Suspense fallback={<div className="rounded-xl border p-4">Laddar…</div>}>
            <ProfileForm initial={profile} />
          </Suspense>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-2xl border bg-gradient-to-b from-zinc-900/50 to-zinc-900/20 p-6">
            <h2 className="text-lg font-medium mb-4">Förhandsvisning</h2>
            <div className="text-sm text-zinc-300 space-y-1">
              <p><span className="text-zinc-400">Namn:</span> {profile?.displayName ?? "—"}</p>
              <p><span className="text-zinc-400">Region:</span> {profile?.region ?? "—"}</p>
              <p><span className="text-zinc-400">Språk (UI):</span> {profile?.uiLanguage ?? "—"}</p>
              <p>
                <span className="text-zinc-400">Födelsedag:</span>{" "}
                {profile?.dob ? profile.dob : "—"}
              </p>
              <p>
                <span className="text-zinc-400">Favoritgenrer:</span>{" "}
                {(profile?.favoriteGenres ?? []).join(", ") || "—"}
              </p>
              <p>
                <span className="text-zinc-400">Ogillade genrer:</span>{" "}
                {(profile?.dislikedGenres ?? []).join(", ") || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Klientdel i samma fil för enkelhet */
"use client";
import { useEffect, useMemo, useState } from "react";

type Props = { initial: ProfileDTO | null };

function ProfileForm({ initial }: Props) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [region, setRegion] = useState(initial?.region ?? "SE");
  const [locale, setLocale] = useState(initial?.locale ?? "sv-SE");
  const [uiLanguage, setUiLanguage] = useState(initial?.uiLanguage ?? "sv");
  const [dob, setDob] = useState(initial?.dob ?? ""); // <- KONTROLLERAT värde, inga defaults som 2001!
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(initial?.favoriteGenres ?? []);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>(initial?.dislikedGenres ?? []);
  const [providers, setProviders] = useState<string[]>(initial?.providers ?? []);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // En enkel “tag-input” för genrer (behåll din befintliga UI om du vill)
  const genresText = useMemo(() => favoriteGenres.join(", "), [favoriteGenres]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          region,
          locale,
          uiLanguage,
          dob,                        // yyyy-mm-dd
          providers,
          favoriteGenres,
          dislikedGenres,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.message || "Kunde inte spara.");
      setMsg("Sparat! 🎉");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Fel vid sparning.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-zinc-400">Visningsnamn</span>
          <input
            className="rounded-xl border bg-transparent px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ditt namn"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-zinc-400">Födelsedag</span>
          <input
            type="date"
            className="rounded-xl border bg-transparent px-3 py-2"
            value={dob}                                  // <- KONTROLLERAT
            onChange={(e) => setDob(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-zinc-400">Region</span>
          <input
            className="rounded-xl border bg-transparent px-3 py-2"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-zinc-400">Locale</span>
          <input
            className="rounded-xl border bg-transparent px-3 py-2"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-zinc-400">UI-språk</span>
          <input
            className="rounded-xl border bg-transparent px-3 py-2"
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm text-zinc-400">Favoritgenrer (kommaseparerat)</span>
          <input
            className="rounded-xl border bg-transparent px-3 py-2"
            value={genresText}
            onChange={(e) =>
              setFavoriteGenres(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder="Drama, Komedi, Thriller…"
          />
        </label>

        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm text-zinc-400">Ogillade genrer (kommaseparerat)</span>
          <input
            className="rounded-xl border bg-transparent px-3 py-2"
            value={(dislikedGenres ?? []).join(", ")}
            onChange={(e) =>
              setDislikedGenres(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder="Skräck, …"
          />
        </label>

        {/* Providers – behåll din befintliga komponent om du har en.
           Här en enkel textfältlösning så länge. */}
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm text-zinc-400">Tjänster / providers (kommaseparerat)</span>
          <input
            className="rounded-xl border bg-transparent px-3 py-2"
            value={(providers ?? []).join(", ")}
            onChange={(e) =>
              setProviders(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder="netflix, hbo-max, disney-plus…"
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          disabled={saving}
          onClick={onSave}
          className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-2 transition"
        >
          {saving ? "Sparar…" : "Spara"}
        </button>
        {msg && <span className="text-sm text-emerald-400">{msg}</span>}
      </div>
    </div>
  );
}
