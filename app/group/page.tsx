// app/group/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export const dynamic = "force-dynamic";

export default function GroupPage() {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nameInput || undefined }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to create group");
        }
        const code = data.group?.code;
        if (code) {
          router.push(`/group/swipe?code=${encodeURIComponent(code)}`);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to create group");
      }
    });
  };

  const onJoin = () => {
    setError(null);
    const c = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(c)) {
      setError("Enter a valid group code");
      return;
    }
    router.push(`/group/swipe?code=${encodeURIComponent(c)}`);
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Groups</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Create or join a group and start swiping together.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Create */}
        <div className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-lg font-medium">Create a new group</h2>
          <p className="mt-1 text-sm text-neutral-500">
            You&apos;ll get a short code you can share with friends.
          </p>

          <label className="mt-4 block text-sm font-medium">Name (optional)</label>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            placeholder="e.g., Friday Movie Night"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label="Group name"
          />

          <button
            className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2 disabled:opacity-60"
            onClick={onCreate}
            disabled={pending}
          >
            {pending ? "Creating..." : "Create group"}
          </button>
        </div>

        {/* Join */}
        <div className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-lg font-medium">Join with code</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Ask your friend for the 6-character group code.
          </p>

          <label className="mt-4 block text-sm font-medium">Group code</label>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 uppercase"
            placeholder="ABC123"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            aria-label="Group code"
            maxLength={10}
          />

          <button
            className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-2"
            onClick={onJoin}
          >
            Join group
          </button>
        </div>
      </section>
    </main>
  );
}
