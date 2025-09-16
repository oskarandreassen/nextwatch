// app/watchlist/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies, headers } from 'next/headers';
import WatchlistClient from './WatchlistClient';

type ApiItem = {
  tmdbId: number;
  tmdbType: 'movie' | 'tv';
  title: string;
  year?: string | null;
  rating?: number | null;
  posterPath?: string | null;
};

type ApiResponse =
  | { ok: true; items: ApiItem[] }
  | { ok: false; message?: string };

function buildCookieHeader(): string {
  // Skicka vidare alla cookies till API-routen så den kan identifiera användaren
  const jar = cookies();
  const all = jar.getAll();
  return all.map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
}

async function getWatchlistServer(): Promise<ApiItem[]> {
  const host = (await headers()).get('host');
  const proto =
    (await headers()).get('x-forwarded-proto') ??
    (host?.includes('localhost') ? 'http' : 'https');

  const url = `${proto}://${host}/api/watchlist/list`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      // kritiskt: vidarebefordra cookies
      Cookie: buildCookieHeader(),
    },
    // important: no-store så vi inte får cachead tom data
    cache: 'no-store',
  });

  if (!res.ok) {
    // Logiskt tomt i UI om API fallerar, men hindra inte sidan
    return [];
  }
  const data = (await res.json()) as ApiResponse;
  if (!('ok' in data) || !data.ok) return [];
  return data.items;
}

export default async function Page() {
  const rows = await getWatchlistServer();

  // Mappa till props för klientkomponenten
  const items = rows.map((r) => ({
    id: r.tmdbId,
    tmdbType: r.tmdbType,
    title: r.title,
    year: r.year ?? undefined,
    rating: typeof r.rating === 'number' ? r.rating : undefined,
    posterUrl: r.posterPath ? `https://image.tmdb.org/t/p/w500${r.posterPath}` : '/placeholder.svg',
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Watchlist</h1>
      <WatchlistClient items={items} />
    </main>
  );
}
