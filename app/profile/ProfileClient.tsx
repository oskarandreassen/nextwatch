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
  // Visa som lista (view) som standard – likt onboardingens sammanfattning.
  const [mode, setMode] = useState<"view" | "edit">("view");

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
      setMode("view");
    } catch (err: unknown) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ===== VIEW (sammanfattning likt onboarding) =====
  if (mode === "view") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryItem label="Visningsnamn" value={form.displayName || "—"} />
          <SummaryItem label="Födelsedatum" value={form.dob || "—"} />
          <SummaryItem label="Region" value={form.region || "—"} />
          <SummaryItem label="Locale" value={form.locale || "—"} />
          <SummaryItem label="UI-språk" value={form.uiLanguage || "—"} />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="rounded bg-black text-white px-4 py-2"
          >
            Redigera
          </button>
          {message && <span className="text-sm">{message}</span>}
        </div>
      </div>
    );
  }

  // ===== EDIT (ditt befintliga formulär) =====
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
        <button
          type="button"
          onClick={() => setMode("view")}
          className="rounded border px-4 py-2"
        >
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
