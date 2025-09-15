// app/lib/providers.ts
export type ProviderKey =
  | "netflix"
  | "disney-plus"
  | "prime-video"
  | "max"
  | "viaplay"
  | "apple-tv-plus"
  | "skyshowtime"
  | "svt-play"
  | "tv4-play";

export type ProviderMeta = {
  key: ProviderKey;
  label: string;
  slug: string; // matchar filnamnet i /public/providers
  badge: string;
};

export const PROVIDERS: ProviderMeta[] = [
  { key: "netflix", label: "Netflix", slug: "netflix", badge: "N" },
  { key: "disney-plus", label: "Disney+", slug: "disney-plus", badge: "D" },
  { key: "prime-video", label: "Prime Video", slug: "prime-video", badge: "PV" },
  { key: "max", label: "Max", slug: "max", badge: "M" },
  { key: "viaplay", label: "Viaplay", slug: "viaplay", badge: "V" },
  { key: "apple-tv-plus", label: "Apple TV+", slug: "apple-tv-plus", badge: "AT" },
  { key: "skyshowtime", label: "SkyShowtime", slug: "skyshowtime", badge: "S" },
  { key: "svt-play", label: "SVT Play", slug: "svt-play", badge: "SP" },
  { key: "tv4-play", label: "TV4 Play", slug: "tv4-play", badge: "TP" },
];
