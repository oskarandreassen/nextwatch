import { cookies } from 'next/headers';
import WatchlistClient from './WatchlistClient';

// Antag att du redan har en server-funktion som listar sparade likes inkl TMDB-id & typ.
// Här visar jag en minimal “shape” – behåll din befintliga källa och mappa till propsen nedan.

type DBItem = {
  tmdbId: number;
  tmdbType: 'movie' | 'tv';
  title: string;
  year?: string;
  rating?: number;
  posterPath?: string;
};

async function getWatchlistServer(): Promise<DBItem[]> {
  const jar = cookies(); // exempel på att vi följer await cookies() i server actions där det behövs
  void jar; // undvik unused
  // ⚠️ Byt mot din befintliga hämtning (DB + TMDB-hydrering).
  return [];
}

export default async function Page() {
  const rows = await getWatchlistServer();

  const items = rows.map((r) => ({
    id: r.tmdbId,
    tmdbType: r.tmdbType,
    title: r.title,
    year: r.year,
    rating: r.rating,
    posterUrl: r.posterPath ? `https://image.tmdb.org/t/p/w500${r.posterPath}` : '/placeholder.svg',
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Watchlist</h1>
      <WatchlistClient items={items} />
    </main>
  );
}
