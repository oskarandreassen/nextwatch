// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Tillåt TMDB-posters och loggor
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        port: "",
        pathname: "/t/p/**",
      },
    ],
    // Om du vill tillåta data-URI som fallback (vi använder det ibland i söklistor):
    // dangerouslyAllowSVG: false,
    // contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Behåll lint/type checks i CI/Prod (vi vill INTE skippa dem)
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
