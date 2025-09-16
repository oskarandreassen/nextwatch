// lib/tmdb.ts
export type TmdbPaged<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

export type TmdbMovie = {
  id: number;
  media_type?: "movie";
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
};

export type TmdbTv = {
  id: number;
  media_type?: "tv";
  name: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
};
 
const READ_TOKEN = process.env.TMDB_READ_TOKEN ?? process.env.TMDB_TOKEN;


/** Minimal typed GET against TMDB v3. */
export async function tmdbGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  if (!READ_TOKEN) throw new Error("TMDB_READ_TOKEN saknas.");
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (typeof v !== "undefined") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${READ_TOKEN}`,
      "Content-Type": "application/json",
    },
    // We want fresh results for swipe
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export function tmdbPoster(path: string | null, size: "w500" | "w780" | "original" = "w500"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// Basic mapping: Swedish/English to TMDB genre ids
const MOVIE_GENRES: Record<string, number> = {
  action: 28, "action & adventure": 10759,
  äventyr: 12, adventure: 12,
  animerat: 16, animation: 16,
  komedi: 35, comedy: 35,
  kriminal: 80, crime: 80,
  dokumentär: 99, documentary: 99,
  drama: 18,
  familj: 10751, family: 10751,
  fantasy: 14,
  historia: 36, history: 36,
  skräck: 27, horror: 27,
  musik: 10402, music: 10402,
  mysterium: 9648, mystery: 9648,
  romantik: 10749, romance: 10749,
  "sci-fi": 878, scifi: 878, "science fiction": 878,
  tvfilm: 10770, "tv movie": 10770,
  thriller: 53,
  krig: 10752, war: 10752,
  western: 37,
};

const TV_GENRES: Record<string, number> = {
  "action & adventure": 10759,
  animerat: 16, animation: 16,
  komedi: 35, comedy: 35,
  kriminal: 80, crime: 80,
  dokumentär: 99, documentary: 99,
  drama: 18,
  familj: 10751, family: 10751,
  barn: 10762, kids: 10762,
  mysterium: 9648, mystery: 9648,
  nyheter: 10763, news: 10763,
  reality: 10764,
  "sci-fi & fantasy": 10765,
  såpopera: 10766, soap: 10766,
  talk: 10767,
  krig: 10768, war: 10768,
  väster: 37, western: 37,
};

export function namesToGenreIds(names: string[]): { movieIds: number[]; tvIds: number[] } {
  const norm = names.map((n) => n.trim().toLowerCase());
  const movieIds = Array.from(new Set(norm.map((n) => MOVIE_GENRES[n]).filter((x): x is number => !!x)));
  const tvIds = Array.from(new Set(norm.map((n) => TV_GENRES[n]).filter((x): x is number => !!x)));
  return { movieIds, tvIds };
}

/** Discover by genres for movies and TV, return two lists */
export async function discoverByGenres(
  region: string,
  movieIds: number[],
  tvIds: number[],
  page = 1
): Promise<{ movies: TmdbMovie[]; tv: TmdbTv[] }> {
  const [movies, tv] = await Promise.all([
    movieIds.length
      ? tmdbGet<TmdbPaged<TmdbMovie>>("discover/movie", {
          with_genres: movieIds.join(","),
          sort_by: "popularity.desc",
          include_adult: false,
          include_video: false,
          page,
          region,
        }).then((r) => r.results)
      : Promise.resolve([] as TmdbMovie[]),
    tvIds.length
      ? tmdbGet<TmdbPaged<TmdbTv>>("discover/tv", {
          with_genres: tvIds.join(","),
          sort_by: "popularity.desc",
          include_adult: false,
          page,
        }).then((r) => r.results)
      : Promise.resolve([] as TmdbTv[]),
  ]);
  return { movies, tv };
}

export async function trendingFallback(): Promise<(TmdbMovie | TmdbTv)[]> {
  const res = await tmdbGet<TmdbPaged<TmdbMovie | TmdbTv>>("trending/all/week");
  return res.results;
}
