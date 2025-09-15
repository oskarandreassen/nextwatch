// app/components/ui/ProviderChip.tsx
"use client";

import Image from "next/image";
import React from "react";

const MAP: Record<string, string> = {
  netflix: "/providers/netflix.svg",
  "disney+": "/providers/disney-plus.svg",
  disney: "/providers/disney-plus.svg",
  "prime video": "/providers/prime-video.svg",
  prime: "/providers/prime-video.svg",
  max: "/providers/max.svg",
  viaplay: "/providers/viaplay.svg",
  "apple tv+": "/providers/apple-tv-plus.svg",
  appletv: "/providers/apple-tv-plus.svg",
  skyshowtime: "/providers/skyshowtime.svg",
  "svt play": "/providers/svt-play.svg",
  svt: "/providers/svt-play.svg",
  "tv4 play": "/providers/tv4-play.svg",
  tv4: "/providers/tv4-play.svg",
};

function keyify(label: string) {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

export function ProviderChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const key = keyify(label);
  const src = MAP[key];

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 transition",
        selected ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
    >
      {src ? (
        <span className="relative inline-block h-5 w-5">
          <Image src={src} alt={label} fill sizes="20px" />
        </span>
      ) : (
        <span className="grid h-5 w-5 place-items-center rounded bg-white/20 text-[10px] font-bold">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="text-sm">{label}</span>
    </button>
  );
}
