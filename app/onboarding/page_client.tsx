"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type FavoriteTitle = {
  id?: number | string;
  title?: string;
  name?: string;
  year?: string;
  poster?: string | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD (input type="date")
  const [region, setRegion] = useState("SE");
  const [locale, setLocale] = useState("sv-SE");
  const [uiLanguage, setUiLanguage] = useState("sv");
  const [providers, setProviders] = useState<string[]>([]);
  const [favoriteMovie, setFavoriteMovie] = useState<FavoriteTitle | null>(null);
  const [favoriteShow, setFavoriteShow] = useState<FavoriteTitle | null>(null);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    // Minimal payload som matchar vår route.ts
    const payload = {
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

    try {
      const res = await fetch("/api/profile/save-onboarding?debug=0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Ett fel uppstod vid sparning.");
      }

      // ✅ Onboarding sparad — gå direkt vidare till registrering av e-post/lösen
      router.replace("/auth/register");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ett fel uppstod.");
    } finally {
      setLoading(false);
    }
  }

  // En väldigt enkel form bara för flödet – bind dina riktiga UI-komponenter här
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold mb-4">Onboarding</h1>
      {err && (
        <div className="mb-3 rounded bg-red-500/10 text-red-600 p-3 text-sm">
          {err}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm">Visningsnamn</span>
          <input
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ditt namn…"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Födelsedatum</span>
          <input
            type="date"
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm">Region</span>
            <input
              className="mt-1 w-full rounded border bg-transparent p-2"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm">Locale</span>
            <input
              className="mt-1 w-full rounded border bg-transparent p-2"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm">UI-språk</span>
          <input
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={uiLanguage}
            onChange={(e) => setUiLanguage(e.target.value)}
            required
          />
        </label>

        {/* Providers (enkel kommaseparerad input för demo) */}
        <label className="block">
          <span className="text-sm">Providers (kommaseparerat)</span>
          <input
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={providers.join(",")}
            onChange={(e) =>
              setProviders(
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded bg-white/10 py-2 hover:bg-white/20 disabled:opacity-50"
        >
          {loading ? "Sparar…" : "Spara & börja"}
        </button>
      </form>
    </div>
  );
}
