// app/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NextDynamic from "next/dynamic";
import LoginCard from "./components/auth/LoginCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ladda hero-klientkomponenten utan SSR
const HeroReel = NextDynamic(() => import("./components/landing/HeroReel"), { ssr: false });

export default async function HomePage() {
  // Regler: alltid await cookies() i App Router (server)
  const jar = await cookies();

  const uid = jar.get("nw_uid")?.value ?? null;
  const lastStr = jar.get("nw_last")?.value ?? null;
  const within5min =
    lastStr ? Date.now() - Number.parseInt(lastStr, 10) < 5 * 60 * 1000 : false;

  if (uid && within5min) {
    redirect("/swipe");
  }

  return (
    <div className="relative min-h-dvh">
      <HeroReel durationMs={12000} />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
          Hitta nästa film/serie – snabbt
        </h1>
        <p className="mt-4 text-neutral-300">
          Tinder-känsla för film &amp; serier. Bygg smakprofil, swipa solo eller i grupp.
        </p>

        <div className="mt-8">
          <LoginCard />
        </div>

        {/* Dubblett-CTA borttagen – LoginCard hanterar konto/onboarding */}
      </div>
    </div>
  );
}
