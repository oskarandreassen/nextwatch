// app/auth/register/page.tsx
import RegisterClient from "./page_client";

export const dynamic = "force-static";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="mb-4 text-2xl font-semibold">Skapa konto</h1>
        <RegisterClient />
      </div>
    </main>
  );
}
