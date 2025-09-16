// app/api/watchlist/detail/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function tmdbGet<T>(path: string): Promise<T> {
  const v4 = process.env.TMDB_v4_TOKEN;
  const v3 = process.env.TMDB_API_KEY;
  const headers: Record<string, string> = {};
  if (v4) headers.Authorization = `Bearer ${v4}`;
  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${v3 ?? ''}&language=en-US`;
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

type MovieDetail = {
  overview?: string;
  runtime?: number;
};

type TvDetail = {
  overview?: string;
  episode_run_time?: number[];
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type'); // movie|tv
    if (!id || (type !== 'movie' && type !== 'tv')) {
      return NextResponse.json({ ok: false, message: 'Missing id or invalid type.' }, { status: 400 });
    }

    const data = await tmdbGet<MovieDetail | TvDetail>(`/${type}/${id}`);

    const overview = data?.overview;
    const runtime = type === 'movie' ? (data as MovieDetail)?.runtime : undefined;
    const episode_run_time = type === 'tv' ? (data as TvDetail)?.episode_run_time : undefined;

    return NextResponse.json({ overview, runtime, episode_run_time }, { status: 200 });
  } catch (e) {
    console.error('[detail GET] ', e);
    // Leverera tomt men 200 så modalen fortfarande visas
    return NextResponse.json({}, { status: 200 });
  }
}
