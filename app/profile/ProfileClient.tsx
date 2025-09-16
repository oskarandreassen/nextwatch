"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProfileDTO } from "./page";

type Props = { initial: ProfileDTO | null };

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Något gick fel.";
}

export default function ProfileClient({ initial }: Props) {
  const [form, setForm] = useState({
    displayName: initial?.displayName ?? "",
    dob: initial?.dob ?? "",
    region: initial?.region ?? "SE",
    locale: initial?.locale ?? "sv-SE",
    uiLanguage: initial?.uiLanguage ?? "sv",
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
    });
  }, [initial]);

  const canSave = useMemo(() => {
    return Boolean(form.displayName && form.region && form.locale && form.uiLanguage);
  }, [form]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          dob: form.dob || null,
          region: form.region,
          locale: form.locale,
          uiLanguage: form.uiLanguage,
        }),
      });

      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Kunde inte spara profilen.");
      }
      setMessage("Sparat!");
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <div className="space-y-2">
        <label className="block text-sm font-medium">Region</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.region}
          onChange={(e) => setForm((s) => ({ ...s, region: e.target.value.toUpperCase() }))}
          placeholder="SE"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Locale</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.locale}
          onChange={(e) => setForm((s) => ({ ...s, locale: e.target.value }))}
          placeholder="sv-SE"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="block text-sm font-medium">UI-språk</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={form.uiLanguage}
          onChange={(e) => setForm((s) => ({ ...s, uiLanguage: e.target.value }))}
          placeholder="sv"
        />
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSave || saving}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Sparar..." : "Spara"}
        </button>
        {message && <span className="text-sm">{message}</span>}
      </div>
    </form>
  );
}
