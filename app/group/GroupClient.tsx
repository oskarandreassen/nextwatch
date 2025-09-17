"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GroupInitial, PublicMember } from "./page";

type ApiOk = { ok: true };
type ApiErr = { ok: false; message?: string };
type Api<T> = (ApiOk & T) | ApiErr;

type MembersResp = {
  group: { code: string; region: string };
  members: PublicMember[];
};

type SearchStatus = "NONE" | "PENDING_OUT" | "PENDING_IN" | "ACCEPTED";

type SearchUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  status: SearchStatus;
};

type SearchResp = { users: SearchUser[] };

type FriendsListUser = {
  id: string;
  username: string | null;
  displayName: string | null;
};

type FriendsListResp = {
  friends: FriendsListUser[];
  pendingIn: { requestId: string; from: FriendsListUser }[];
  pendingOut: { requestId: string; to: FriendsListUser }[];
};

type RequestResp = { status: "PENDING_OUT" | "ACCEPTED" };

function classNames(...xs: string[]): string {
  return xs.filter(Boolean).join(" ");
}

async function getMembers(code: string | null): Promise<Api<MembersResp>> {
  const url = code ? `/api/group/members?code=${encodeURIComponent(code)}` : "/api/group/members";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let message = "Kunde inte ladda gruppen.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  const data = (await res.json()) as Api<MembersResp>;
  return data;
}

async function createGroup(name?: string): Promise<Api<{ group: { code: string } }>> {
  const res = await fetch("/api/group/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
  if (!res.ok) {
    let message = "Kunde inte skapa grupp.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  return (await res.json()) as Api<{ group: { code: string } }>;
}

async function joinGroup(code: string): Promise<Api<{ group: { code: string } }>> {
  const res = await fetch("/api/group/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    let message = "Kunde inte gå med i grupp.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  return (await res.json()) as Api<{ group: { code: string } }>;
}

async function leaveGroup(code: string): Promise<ApiOk | ApiErr> {
  const res = await fetch("/api/group/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    let message = "Kunde inte lämna gruppen.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  return (await res.json()) as ApiOk | ApiErr;
}

async function friendsSearch(q: string): Promise<Api<SearchResp>> {
  const url = `/api/friends/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let message = "Sökning misslyckades.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  return (await res.json()) as Api<SearchResp>;
}

async function friendsList(): Promise<Api<FriendsListResp>> {
  const res = await fetch("/api/friends/list", { cache: "no-store" });
  if (!res.ok) {
    let message = "Kunde inte hämta kompisar.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  return (await res.json()) as Api<FriendsListResp>;
}

async function friendRequestById(userId: string): Promise<Api<RequestResp>> {
  const res = await fetch("/api/friends/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    let message = "Kunde inte skicka förfrågan.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  return (await res.json()) as Api<RequestResp>;
}

async function acceptFriend(requestId: string): Promise<ApiOk | ApiErr> {
  const res = await fetch("/api/friends/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) {
    let message = "Kunde inte acceptera.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch { /* ignore */ }
    return { ok: false, message };
  }
  return (await res.json()) as ApiOk | ApiErr;
}

export default function GroupClient({ initial }: { initial: GroupInitial }) {
  const [tab, setTab] = useState<"group" | "friends">("group");

  const [code, setCode] = useState<string | null>(initial.code);
  const [region] = useState<string>(initial.region);
  const [members, setMembers] = useState<PublicMember[]>(initial.members);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  // Friends state
  const [friends, setFriends] = useState<FriendsListUser[]>([]);
  const [pendingIn, setPendingIn] = useState<{ requestId: string; from: FriendsListUser }[]>([]);
  const [pendingOut, setPendingOut] = useState<{ requestId: string; to: FriendsListUser }[]>([]);

  // Search state
  const [q, setQ] = useState<string>("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = useMemo(() => Boolean(code), [code]);

  useEffect(() => {
    // Ladda friends-listan direkt när man går in på fliken
    if (tab !== "friends") return;
    (async () => {
      const resp = await friendsList();
      if (resp.ok) {
        setFriends(resp.friends);
        setPendingIn(resp.pendingIn);
        setPendingOut(resp.pendingOut);
      } else {
        setError(resp.message ?? "Ett fel uppstod.");
      }
    })();
  }, [tab]);

  const refreshMembers = async () => {
    const c = code;
    if (!c) return;
    const data = await getMembers(c);
    if (data.ok) {
      setMembers(data.members);
    } else {
      setError(data.message ?? "Ett fel uppstod.");
    }
  };

  const handleCreate = async (name?: string) => {
    setBusy(true);
    setError(null);
    const resp = await createGroup(name);
    setBusy(false);
    if (resp.ok) {
      setCode(resp.group.code);
      await refreshMembers();
    } else {
      setError(resp.message ?? "Ett fel uppstod.");
    }
  };

  const handleJoin = async (raw: string) => {
    const joinCode = raw.trim().toUpperCase();
    if (joinCode.length < 4) {
      setError("Ogiltig kod.");
      return;
    }
    setBusy(true);
    setError(null);
    const resp = await joinGroup(joinCode);
    setBusy(false);
    if (resp.ok) {
      setCode(resp.group.code);
      await refreshMembers();
    } else {
      setError(resp.message ?? "Ett fel uppstod.");
    }
  };

  const handleLeave = async () => {
    const c = code;
    if (!c) return;
    setBusy(true);
    setError(null);
    const resp = await leaveGroup(c);
    setBusy(false);
    if (resp.ok) {
      setCode(null);
      setMembers([]);
    } else {
      setError(resp.message ?? "Ett fel uppstod.");
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // ignore
    }
  };

  const quickAdd = async (userId: string) => {
    const resp = await friendRequestById(userId);
    if (!resp.ok) {
      setError(resp.message ?? "Kunde inte lägga till vän.");
      return;
    }
    // Visa feedback lokalt: inget serverkrav här
  };

  // Debounced search
  useEffect(() => {
    if (tab !== "friends") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const resp = await friendsSearch(q.trim());
      if (resp.ok) setResults(resp.users);
      else setError(resp.message ?? "Ett fel uppstod.");
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, tab]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Group</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          className={classNames(
            "rounded-xl px-4 py-2",
            tab === "group" ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
          )}
          onClick={() => setTab("group")}
        >
          Group
        </button>
        <button
          className={classNames(
            "rounded-xl px-4 py-2",
            tab === "friends" ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
          )}
          onClick={() => setTab("friends")}
        >
          Friends
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {tab === "group" ? (
        <section className="space-y-6">
          {/* Active group card */}
          {active ? (
            <div className="rounded-2xl bg-neutral-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-400">Active group</div>
                  <div className="text-xl font-semibold">
                    Code: <span className="font-mono tracking-widest">{code}</span>
                  </div>
                  <div className="text-xs text-neutral-500">Region: {region}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    className="rounded-xl border border-neutral-700 px-3 py-2 hover:bg-neutral-800"
                  >
                    Copy code
                  </button>
                  <button
                    onClick={refreshMembers}
                    className="rounded-xl border border-neutral-700 px-3 py-2 hover:bg-neutral-800"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={handleLeave}
                    disabled={busy}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-white hover:bg-rose-500 disabled:opacity-60"
                  >
                    Leave
                  </button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">Members</h3>
                {members.length === 0 ? (
                  <p className="text-sm text-neutral-400">Inga medlemmar ännu.</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {m.displayName ?? m.username ?? "Okänd"}
                          </div>
                          {m.providers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 text-xs text-neutral-400">
                              {m.providers.map((p) => (
                                <span key={`${m.id}-${p}`} className="rounded bg-neutral-800 px-2 py-0.5">
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => quickAdd(m.id)}
                            className="rounded-xl border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                            title="Add friend"
                          >
                            + Add
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            // No active group: Join or Create
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <JoinCard onJoin={handleJoin} busy={busy} />
              <CreateCard onCreate={handleCreate} busy={busy} />
            </div>
          )}
        </section>
      ) : (
        // Friends tab
        <section className="space-y-6">
          <div className="rounded-2xl bg-neutral-900 p-5">
            <h3 className="mb-3 text-lg font-semibold">Find friends</h3>
            <input
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-violet-600"
              placeholder="Search by username or display name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {results.length > 0 && (
              <ul className="mt-3 space-y-2">
                {results.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.displayName ?? u.username ?? "Okänd"}</div>
                      <div className="text-xs text-neutral-500">
                        {u.username ? `@${u.username}` : "—"}
                      </div>
                    </div>
                    <div>
                      {u.status === "ACCEPTED" ? (
                        <span className="text-xs text-emerald-400">Friends</span>
                      ) : u.status === "PENDING_OUT" ? (
                        <span className="text-xs text-neutral-400">Requested</span>
                      ) : u.status === "PENDING_IN" ? (
                        <span className="text-xs text-amber-400">Requested you</span>
                      ) : (
                        <button
                          onClick={async () => {
                            const resp = await friendRequestById(u.id);
                            if (!resp.ok) setError(resp.message ?? "Kunde inte skicka förfrågan.");
                          }}
                          className="rounded-xl border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-neutral-900 p-5">
            <h3 className="mb-3 text-lg font-semibold">Requests</h3>
            {pendingIn.length === 0 && pendingOut.length === 0 ? (
              <p className="text-sm text-neutral-400">Inga förfrågningar.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-medium">Incoming</h4>
                  <ul className="space-y-2">
                    {pendingIn.map((r) => (
                      <li key={r.requestId} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                        <div className="truncate">
                          {r.from.displayName ?? r.from.username ?? "Okänd"}
                        </div>
                        <button
                          onClick={async () => {
                            const resp = await acceptFriend(r.requestId);
                            if (!resp.ok) {
                              setError(resp.message ?? "Kunde inte acceptera.");
                              return;
                            }
                            // Refresh list
                            const fl = await friendsList();
                            if (fl.ok) {
                              setFriends(fl.friends);
                              setPendingIn(fl.pendingIn);
                              setPendingOut(fl.pendingOut);
                            }
                          }}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
                        >
                          Accept
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">Outgoing</h4>
                  <ul className="space-y-2">
                    {pendingOut.map((r) => (
                      <li key={r.requestId} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                        <div className="truncate">
                          {r.to.displayName ?? r.to.username ?? "Okänd"}
                        </div>
                        <span className="text-xs text-neutral-400">Pending…</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-neutral-900 p-5">
            <h3 className="mb-3 text-lg font-semibold">Friends</h3>
            {friends.length === 0 ? (
              <p className="text-sm text-neutral-400">Du har inga vänner ännu.</p>
            ) : (
              <ul className="space-y-2">
                {friends.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                    <div className="truncate">
                      {f.displayName ?? f.username ?? "Okänd"}
                    </div>
                    <span className="text-xs text-emerald-400">Friend</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function JoinCard({ onJoin, busy }: { onJoin: (code: string) => void; busy: boolean }) {
  const [code, setCode] = useState<string>("");

  return (
    <div className="rounded-2xl bg-neutral-900 p-5">
      <h3 className="mb-3 text-lg font-semibold">Join group</h3>
      <input
        className="mb-3 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-violet-600"
        placeholder="Enter code (e.g. ABC123)…"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button
        onClick={() => onJoin(code)}
        disabled={busy}
        className="rounded-xl bg-violet-600 px-4 py-2 text-white hover:bg-violet-500 disabled:opacity-60"
      >
        Join
      </button>
    </div>
  );
}

function CreateCard({ onCreate, busy }: { onCreate: (name?: string) => void; busy: boolean }) {
  const [name, setName] = useState<string>("");

  return (
    <div className="rounded-2xl bg-neutral-900 p-5">
      <h3 className="mb-3 text-lg font-semibold">Create group</h3>
      <input
        className="mb-3 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-violet-600"
        placeholder="Group name (optional)…"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        onClick={() => onCreate(name.trim() || undefined)}
        disabled={busy}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        Create
      </button>
    </div>
  );
}
