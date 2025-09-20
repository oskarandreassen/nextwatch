// app/api/recs/_known-filter.ts
import { PrismaClient } from "@prisma/client";

export type MediaType = "movie" | "tv";

export type UnifiedCard = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year?: string | null;
  poster?: string | null;
  overview?: string | null;
  voteAverage?: number | null;
};

const prisma = new PrismaClient();

export async function filterOutKnownForUser(
  userId: string,
  items: UnifiedCard[]
): Promise<UnifiedCard[]> {
  if (!items.length) return items;

  const [wl, rated] = await Promise.all([
    prisma.watchlist.findMany({
      where: { userId },
      select: { tmdbId: true, mediaType: true },
    }),
    prisma.rating.findMany({
      where: {
        userId,
        // allt som är "känt": betygsatts, gillats eller ogillats
        OR: [{ rating: { not: null } }, { decision: { in: ["LIKE", "DISLIKE", "RATED"] } }],
      },
      select: { tmdbId: true, mediaType: true },
    }),
  ]);

  const known = new Set(
    [...wl, ...rated].map((x) => `${x.mediaType}:${x.tmdbId}`)
  );

  return items.filter((it) => !known.has(`${it.mediaType}:${it.tmdbId}`));
}
