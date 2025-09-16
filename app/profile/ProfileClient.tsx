"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProfileDTO } from "./page";

type Props = { initial: ProfileDTO | null };

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Något gick fel.";
}

// === Hjälpare (utan any) ===
function toArrayFromCSV(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
function toCSV(arr: string[] | undefined | null): string {
  return (arr ?? []).join(", ");
}
function arrOfStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}
function pickArray(obj: unknown, key: "favoriteGenres" | "dislikedGenres" | "providers"): string[] {
  if (obj && typeof obj === "object" && key in obj) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (obj as Record<string, unknown>)[key];
    return arrOfStrings(val);
  }
  return [];
}

// Vanliga förval
const REGION_OPTS = ["SE", "NO", "DK", "FI", "GB", "US", "DE", "FR", "ES", "IT", "NL"];
const LOCALE_OPTS = ["sv-SE", "en-GB", "en-US", "no-NO", "da-DK", "fi-FI", "de-DE", "fr-FR", "es-ES", "it-IT", "nl-NL"];

export default function ProfileClient({ initial }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const [form, setForm] = useState({
    displayName: initial?.displayName ?? "",
    dob: initial?.dob ?? "",
    region: initial?.region ?? "SE",
    locale: initial?.locale ?? "sv-SE",
    uiLanguage: initial?.uiLanguage ?? "sv",

    favoriteGenresCSV: toCSV(pickArray(initial, "favoriteGenres")),
    dislikedGenresCSV: toCSV(pickArray(initial, "dislikedGenres")),
    providersCSV: toCSV(pickArray(initial, "providers")),
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      displayName: initial?.displayName ?? "",
      dob: initial?.dob ?? "",
      region: initial?.region ?? "SE",
      locale: initial?.locale ?? "sv-SE",
      uiLanguage: initial?.uiLanguage ?? "sv",
      favoriteGenresCSV: toCSV(pickArray(initial, "favoriteGenres")),
      dislikedGenresCSV: toCSV(pickArray(initial, "dislikedGenres")),
      providersCSV: toCSV(pickArray(initial, "providers")),
    });
  }, [initial]);

  const canSave = useMemo(() => {
    return Boolean(form.displayName && form.region && form.locale && form.uiLanguage);
  }, [form]);

  function useDeviceLocale() {
    const lang = typeof navigator !== "undefined" ? navigator.language : "";
    if (!lang) return;
    const ui = lang.split("-")[0] || "sv";
    const region = lang.includes("-") ? lang.split("-")[1].toUpperCase() : "SE";
    setForm((s) => ({ ...s, locale: lang, uiLanguage: ui, region }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        displayName: form.displayName.trim(),
        dob: form.dob || null,
        region: form.region,
        locale: form.locale,
        uiLanguage: form.uiLanguage,
        favoriteGenres: toArrayFromCSV(form.favoriteGenresCSV),
        dislikedGenres: toArrayFromCSV(form.dislikedGenresCSV),
        providers: toArrayFromCSV(form.providersCSV),
      };

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message || "Kunde inte spara profilen.");

      setMessage("Sparat!");
      setMode("view");
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (mode === "view") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryItem label="Visningsnamn" value={form.displayName || "—"} />
          <SummaryItem label="Födelsedatum" value={form.dob || "—"} />
          <SummaryItem label="Region" value={form.region || "—"} />
          <SummaryItem label="Locale" value={form.locale || "—"} />
          <SummaryItem label="UI-språk" value={form.uiLanguage || "—"} />
          <SummaryItem label="Favoritgenrer" value={form.favoriteGenresCSV || "—"} />
          <SummaryItem label="Ogillar" value={form.dislikedGenresCSV || "—"} />
          <SummaryItem label="Tjänster" value={form.providersCSV || "—"} />
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMode("edit")} className="rounded bg-black text-white px-4 py-2">
            Redigera
          </button>
          {message && <span className="text-sm">{message}</span>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Basic */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Visningsnamn</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.displayName}
          onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))}
          placeholder="Ditt namn"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Födelsedatum</label>
        <input
          type="date"
          className="w-full rounded border px-3 py-2"
          value={form.dob}
          onChange={(e) => setForm((s) => ({ ...s, dob: e.target.value }))}
        />
      </div>

      {/* Region/Locale/UI */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Region</label>
        <select
          className="w-full rounded border px-3 py-2 bg-black"
          value={form.region}
          onChange={(e) => setForm((s) => ({ ...s, region: e.target.value.toUpperCase() }))}
        >
          {[form.region, ...REGION_OPTS.filter((r) => r !== form.region)].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Locale</label>
        <select
          className="w-full rounded border px-3 py-2 bg:black"
          value={form.locale}
          onChange={(e) => setForm((s) => ({ ...s, locale: e.target.value }))}
        >
          {[form.locale, ...LOCALE_OPTS.filter((l) => l !== form.locale)].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="block text-sm font-medium">UI-språk</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.uiLanguage}
          onChange={(e) => setForm((s) => ({ ...s, uiLanguage: e.target.value }))}
          placeholder="sv"
        />
        <button
          type="button"
          onClick={useDeviceLocale}
          className="mt-2 rounded border px-3 py-1 text-sm"
          title="Hämta baserat på din enhet"
        >
          Hämta från enhet
        </button>
      </div>

      {/* Preferenser */}
      <div className="space-y-2 md:col-span-2">
        <label className="block text-sm font-medium">Favoritgenrer (komma-separerat)</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.favoriteGenresCSV}
          onChange={(e) => setForm((s) => ({ ...s, favoriteGenresCSV: e.target.value }))}
          placeholder="Action, Komedi, Drama"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="block text-sm font-medium">Ogillar (komma-separerat)</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.dislikedGenresCSV}
          onChange={(e) => setForm((s) => ({ ...s, dislikedGenresCSV: e.target.value }))}
          placeholder="Skräck, Western"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="block text-sm font-medium">Tjänster / Providers (komma-separerat)</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.providersCSV}
          onChange={(e) => setForm((s) => ({ ...s, providersCSV: e.target.value }))}
          placeholder="Netflix, Viaplay, HBO Max"
        />
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={!canSave || saving} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
          {saving ? "Sparar..." : "Spara"}
        </button>
        <button type="button" onClick={() => setMode("view")} className="rounded border px-4 py-2">
          Avbryt
        </button>
        {message && <span className="text-sm">{message}</span>}
      </div>
    </form>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border px-3 py-2">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-base">{value}</div>
    </div>
  );
}
