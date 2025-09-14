// app/components/onboarding/ProviderPicker.tsx
"use client";

import Image from "next/image";
import clsx from "clsx";

type Provider = {
  key: string;        // slug + används som filnamn i /public/providers/<key>.svg
  label: string;
};

const ALL_PROVIDERS: Provider[] = [
  { key: "netflix", label: "Netflix" },
  { key: "disney-plus", label: "Disney+" },
  { key: "prime-video", label: "Prime Video" },
  { key: "max", label: "Max" },
  { key: "viaplay", label: "Viaplay" },
  { key: "apple-tv-plus", label: "Apple TV+" },
  { key: "skyshowtime", label: "SkyShowtime" },
  { key: "svt-play", label: "SVT Play" },
  { key: "tv4-play", label: "TV4 Play" },
];

export interface ProviderPickerProps {
  value: string[];                   // t.ex. ["Netflix","Disney+"]
  onChange: (providers: string[]) => void;
}

export default function ProviderPicker({ value, onChange }: ProviderPickerProps) {
  const set = new Set(value);

  function toggle(p: Provider) {
    const next = new Set(value);
    if (next.has(p.label)) next.delete(p.label);
    else next.add(p.label);
    onChange(Array.from(next));
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {ALL_PROVIDERS.map((p) => {
        const active = set.has(p.label);
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => toggle(p)}
            className={clsx(
              "flex items-center gap-2 rounded-xl border px-3 py-2",
              active
                ? "border-neutral-400 bg-neutral-800"
                : "border-neutral-700 hover:bg-neutral-900"
            )}
            aria-pressed={active}
          >
            <Logo keyName={p.key} label={p.label} />
            <span className="text-sm text-neutral-100">{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Logo({ keyName, label }: { keyName: string; label: string }) {
  // Försök ladda /public/providers/<slug>.svg. Om saknas → fallback-blob.
  const src = `/providers/${keyName}.svg`;
  return (
    <div className="relative w-6 h-6 overflow-hidden rounded">
      <Image
        src={src}
        alt={label}
        fill
        className="object-contain"
        onError={(e) => {
          // Fallback: ersätt med tom kant + initialer
          const el = (e.target as HTMLImageElement);
          el.style.display = "none";
          const parent = el.parentElement!;
          parent.innerHTML = `<div class="w-6 h-6 text-[10px] grid place-items-center bg-neutral-700 text-white rounded">${label.split(" ").map(s=>s[0]).join("").slice(0,2)}</div>`;
        }}
      />
    </div>
  );
}
