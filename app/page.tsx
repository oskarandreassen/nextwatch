import Link from "next/link";

export const dynamic = "force-static";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <div className="text-3xl font-black tracking-tight">nextwatch</div>
      </header>

      <section className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight">Hitta något att se — snabbt.</h1>
        <p className="mx-auto mb-6 max-w-2xl text-lg opacity-85">
          Personliga rekommendationer baserat på din region, ditt språk och dina streamingtjänster.
          Svep som i Tinder, skapa grupper och få träffar när alla gillar samma titel.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className="rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 font-medium hover:bg-white/15"
          >
            Kom igång
          </Link>
          <Link
            href="/swipe"
            className="rounded-lg border border-white/15 px-5 py-2.5 hover:bg-white/5"
          >
            Gå till Recommendations
          </Link>
          <Link
            href="/group"
            className="rounded-lg border border-white/15 px-5 py-2.5 hover:bg-white/5"
          >
            Skapa en grupp
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 text-sm font-semibold opacity-80">Tinder-likt svep</div>
          <p className="text-sm opacity-80">Vänster/ höger för nej/ja, upp för watchlist, info på baksidan av kortet.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 text-sm font-semibold opacity-80">Grupper</div>
          <p className="text-sm opacity-80">Dela kod och få träff när minst två (eller 60%) gillar samma titel.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-1 text-sm font-semibold opacity-80">Filtrerat för dig</div>
          <p className="text-sm opacity-80">Region, språk och streamingtjänster styr urvalet automatiskt.</p>
        </div>
      </section>
    </main>
  );
}
