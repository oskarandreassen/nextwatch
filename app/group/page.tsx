// app/group/page.tsx
export const dynamic = "force-dynamic";

export default function GroupPage() {
  // Håll denna fil ren från HTTP-handlers (GET/POST) – sådant hör hemma i app/group/route.ts
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Groups</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Create or join a group and start swiping together.
      </p>

      {/* Placeholder-UI — behåll/ersätt med ditt befintliga innehåll */}
      <section className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
            placeholder="Enter group code (e.g., ABC123)"
            aria-label="Group code"
          />
          <button className="mt-2 rounded-md border border-neutral-300 px-3 py-2 sm:mt-0">
            Join
          </button>
        </div>

        <div className="text-sm text-neutral-500">
          Tip: Share your code with friends so you can find a match together.
        </div>
      </section>
    </main>
  );
}
