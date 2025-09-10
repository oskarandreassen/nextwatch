export const dynamic = "force-dynamic";

export default function PremiumSuccess() {
  return (
    <div className="max-w-lg mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">Tack för köpet!</h1>
      <p>Din premium bör aktiveras inom några sekunder. Ladda om sidan om det inte syns direkt.</p>
      <a className="underline" href="/group">Till grupper</a>
    </div>
  );
}
