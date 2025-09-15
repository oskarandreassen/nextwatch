// app/auth/verify/sent/page.tsx
export const dynamic = "force-static";

export default function VerifySentPage() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="mb-2 text-2xl font-semibold">Kolla din mejl</h1>
        <p className="text-white/70">
          Vi har skickat en länk för att bekräfta din e-post. Öppna mejlet och klicka på länken.
        </p>
        <div className="mt-6 grid gap-3 sm:flex">
          <a
            href="https://mail.google.com"
            className="rounded-xl bg-white/15 px-4 py-2 text-center hover:bg-white/25"
          >
            Öppna Gmail
          </a>
          <a
            href="/auth/request-verify"
            className="rounded-xl border border-white/15 px-4 py-2 text-center hover:bg-white/10"
          >
            Skicka igen
          </a>
        </div>
        <p className="mt-4 text-sm text-white/50">
          Fick du inget mejl? Kolla skräpposten eller skicka igen.
        </p>
      </div>
    </main>
  );
}
