// app/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HeroReel from "./components/landing/HeroReel";
import LoginCard from "./components/auth/LoginCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Regler: alltid await cookies() i App Router (server)
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  const lastStr = jar.get("nw_last")?.value ?? null;
  const within5min = lastStr ? Date.now() - Number.parseInt(lastStr, 10) < 5 * 60 * 1000 : false;
  if (uid && within5min) redirect("/swipe");

  return (
    <div className="relative min-h-dvh">
      {/* Bakgrundsreel – halverad hastighet + pausar tills flera bilder laddat */}
      <HeroReel durationMs={24000} />

      {/* Soft glow bakom hero-title */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-20 h-72 w-[55rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.12),_rgba(0,0,0,0))] blur-2xl" />
      </div>

      {/* Hero copy + login */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-12 text-center md:pt-24">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
          Hitta nästa film/serie – snabbt
        </h1>
        <p className="mt-4 text-neutral-300">
          Tinder-känsla för film &amp; serier. Bygg smakprofil, swipa solo eller i grupp.
        </p>

        <div className="mx-auto mt-8 max-w-md">
          <LoginCard />
        </div>

        {/* Små “feature chips” – utan att röra LoginCard-UI */}
        <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2 text-sm text-white/80">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Personliga tips</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Grupp-swipe</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Streamingtjänster per region</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Favoriter & watchlist</span>
        </div>
      </section>

      {/* Lite “content” under fold – ren text, påverkar inte befintligt UI */}
      <section className="mx-auto mb-16 mt-6 max-w-5xl px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h3 className="mb-1 text-lg font-semibold">Bygg din smak</h3>
            <p className="text-sm text-white/70">Välj genrer, favoritfilm & serie och vilka tjänster du har.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h3 className="mb-1 text-lg font-semibold">Swipa smart</h3>
            <p className="text-sm text-white/70">Snabbt ja/nej med detaljerad info när du vill fördjupa dig.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h3 className="mb-1 text-lg font-semibold">Titta nu</h3>
            <p className="text-sm text-white/70">Direktlänkar till rätt streamingtjänst i din region.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
