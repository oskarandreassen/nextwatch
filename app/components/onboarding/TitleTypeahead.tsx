// app/components/onboarding/TitleTypeahead.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type MediaType = "movie" | "tv";

export type PickedTitle = { id: number; title: string; year?: string; poster?: string | null };

interface Props {
  type: MediaType;
  label: string;
  value?: PickedTitle | null;
  onChange: (v: PickedTitle | null) => void;
  language?: string;
  region?: string;
  placeholder?: string;
}

export default function TitleTypeahead({
  type,
  label,
  value,
  onChange,
  language = "sv-SE",
  region = "SE",
  placeholder = "Sök titel…",
}: Props) {
  const [q, setQ] = useState(value?.title ?? "");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PickedTitle[]>([]);
  const debounced = useDebounce(q, 200);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ(value?.title ?? "");
  }, [value?.title]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!debounced || debounced.length < 2) {
        setItems([]);
        return;
      }
      const url = `/api/tmdb/search?q=${encodeURIComponent(debounced)}&type=${type}&language=${language}&region=${region}`;
      const res = await fetch(url);
      const data = (await res.json()) as { ok: boolean; results: PickedTitle[] };
      if (!ignore) setItems(data.results ?? []);
    })();
    return () => {
      ignore = true;
    };
  }, [debounced, type, language, region]);

  useOutside(boxRef, () => setOpen(false));

  return (
    <div className="w-full" ref={boxRef}>
      <label className="block text-sm text-neutral-400 mb-1">{label}</label>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-neutral-500"
      />

      {open && items.length > 0 && (
        <div className="mt-2 rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl p-2 max-h-72 overflow-auto">
          {items.map((it) => (
            <button
              key={`${it.id}-${it.title}`}
              type="button"
              onClick={() => {
                onChange(it);
                setQ(`${it.title}${it.year ? ` (${it.year})` : ""}`);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-neutral-800"
            >
              {it.poster ? (
                <Image
                  src={it.poster}
                  alt={it.title}
                  width={32}
                  height={48}
                  className="rounded-md object-cover"
                />
              ) : (
                <div className="w-8 h-12 rounded-md bg-neutral-800" />
              )}
              <div className="text-left">
                <div className="text-neutral-100">{it.title}</div>
                {it.year && <div className="text-xs text-neutral-400">{it.year}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useDebounce<T>(v: T, ms: number) {
  const [s, setS] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setS(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return s;
}

function useOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      cb();
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}
