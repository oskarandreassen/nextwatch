"use client";

import AppShell from "../components/layouts/AppShell";

export default function DiscoverPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Discover</h1>
        <p className="opacity-80">
          Utforska populärt, genrelistor och sök – kommer snart. Tills vidare: testa{" "}
          <a className="underline" href="/swipe">personliga svepet</a>.
        </p>
      </main>
    </AppShell>
  );
}
