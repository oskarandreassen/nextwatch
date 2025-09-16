'use client';

import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import Modal from '@/app/components/ui/Modal';
import WatchNowButton from '@/app/components/watch/WatchNowButton';

type WatchItem = {
  id: number;
  tmdbType: 'movie' | 'tv';
  title: string;
  year?: string;
  rating?: number;
  posterUrl: string;
};

type Providers = {
  link?: string;
  flatrate?: { provider_name: string; logo_path: string | null }[];
  rent?: { provider_name: string; logo_path: string | null }[];
  buy?: { provider_name: string; logo_path: string | null }[];
};

type ProvidersResp = {
  ok: boolean;
  region?: string;
  providers: Providers | null;
};

type Detail = {
  overview?: string;
  runtime?: number; // movies
  episode_run_time?: number[]; // tv
};

async function fetchProviders(id: number, tmdbType: 'movie' | 'tv'): Promise<ProvidersResp> {
  const url = `/api/tmdb/watch-providers?id=${id}&type=${tmdbType}`;
  const res = await fetch(url, { cache: 'no-store' });
  return (await res.json()) as ProvidersResp;
}

async function fetchDetail(id: number, tmdbType: 'movie' | 'tv'): Promise<Detail> {
  const res = await fetch(`/api/watchlist/detail?id=${id}&type=${tmdbType}`, { cache: 'no-store' });
  if (!res.ok) return {};
  return (await res.json()) as Detail;
}

export default function WatchlistClient({ items }: { items: WatchItem[] }) {
  const [active, setActive] = useState<WatchItem | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [detail, setDetail] = useState<Detail>({});
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (item: WatchItem) => {
    setActive(item);
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        fetchProviders(item.id, item.tmdbType),
        fetchDetail(item.id, item.tmdbType),
      ]);
      setProviders(p.ok ? p.providers : null);
      setDetail(d);
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setActive(null);
    setProviders(null);
    setDetail({});
  }, []);

  const groups = useMemo(() => {
    if (!providers) return [];
    const out: { label: string; list: NonNullable<Providers['flatrate']> }[] = [];
    if (providers.flatrate?.length) out.push({ label: 'Streama', list: providers.flatrate });
    if (providers.rent?.length) out.push({ label: 'Hyr', list: providers.rent });
    if (providers.buy?.length) out.push({ label: 'Köp', list: providers.buy });
    return out;
  }, [providers]);

  if (!items.length) {
    return <p className="text-neutral-400">Din watchlist är tom.</p>;
  }

  return (
    <>
      {/* Grid med klickbara kort */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((it) => (
          <button
            key={`${it.tmdbType}-${it.id}`}
            onClick={() => open(it)}
            className="group relative overflow-hidden rounded-2xl bg-neutral-800 transition hover:ring-2 hover:ring-violet-500"
          >
            <div className="relative h-64 w-full">
              <Image
                src={it.posterUrl}
                alt={it.title}
                fill
                sizes="(max-width:768px) 50vw, (max-width:1200px) 25vw, 20vw"
                className="object-cover"
                priority={false}
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-left">
              <div className="truncate">
                <p className="truncate text-sm font-semibold text-white">{it.title}</p>
                <p className="text-xs text-neutral-400">
                  {it.year ?? ''}{it.year && it.rating ? ' • ' : ''}{typeof it.rating === 'number' ? it.rating.toFixed(1) : ''}
                </p>
              </div>
              <span className="ml-2 rounded-md bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200">
                Visa
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Modal */}
      <Modal open={Boolean(active)} onClose={close} labelledBy="watchlist-modal-title">
        {active && (
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative mx-auto h-[320px] w-[220px] shrink-0 overflow-hidden rounded-2xl md:mx-0">
              <Image
                src={active.posterUrl}
                alt={active.title}
                fill
                sizes="220px"
                className="object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h2 id="watchlist-modal-title" className="text-xl font-bold text-white">
                {active.title}{active.year ? ` (${active.year})` : ''}
              </h2>
              <p className="mt-1 text-sm text-neutral-300">
                {typeof active.rating === 'number' ? `Betyg: ${active.rating.toFixed(1)}` : 'Betyg saknas'}
              </p>

              <p className="mt-3 text-sm leading-relaxed text-neutral-200">
                {loading ? 'Laddar info…' : (detail.overview || 'Ingen beskrivning tillgänglig.')}
              </p>

              {/* Providers */}
              <div className="mt-4 space-y-3">
                {groups.length === 0 && !loading && (
                  <p className="text-sm text-neutral-400">Ingen tillgänglig streamingdata för din region just nu.</p>
                )}
                {groups.map(({ label, list }) => (
                  <div key={label}>
                    <p className="mb-2 text-xs uppercase tracking-wide text-neutral-400">{label}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {list.map((p) => (
                        <span
                          key={p.provider_name}
                          className="inline-flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-200"
                          title={p.provider_name}
                        >
                          {p.logo_path && (
                            <span className="relative inline-block h-5 w-5 overflow-hidden rounded">
                              <Image
                                src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                                alt={p.provider_name}
                                fill
                                sizes="20px"
                                className="object-contain"
                              />
                            </span>
                          )}
                          {p.provider_name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Primär CTA */}
              <div className="mt-5">
                <WatchNowButton url={providers?.link} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
