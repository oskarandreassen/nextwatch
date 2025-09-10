"use client";

import AppShell from "../components/layouts/AppShell";

export default function ProfilePage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Profil</h1>
        <p className="opacity-80">
          Uppdatera språk, region, ålder och tjänster på{" "}
          <a className="underline" href="/onboarding">onboarding-sidan</a>.
        </p>
        <div className="mt-4">
          <a className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5" href="/premium">
            Hantera Premium
          </a>
        </div>
      </main>
    </AppShell>
  );
}
