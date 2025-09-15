// lib/tmdb.ts
import "server-only";

export type TmdbPaged<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

export const READ_TOKEN = process.env.TMDB_READ_TOKEN;

/** Strikt TMDB GET med V4 Read Access Token */
export async function tmdbGet<T>(
  path: string,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  if (!READ_TOKEN) throw new Error("TMDB_READ_TOKEN saknas.");

  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${READ_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TMDB ${res.status} on ${path}: ${text || "<empty>"}`);
  }

  return (await res.json()) as T;
}
