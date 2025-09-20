// app/group/GroupClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { GroupInitial as BaseGroupInitial, PublicMember as BasePublicMember } from "./page";

/** UI-hjälpare */
function classNames(...xs: string[]): string {
  return xs.filter(Boolean).join(" ");
}
/** Läs cookie-värde på klientsidan */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
/** Type guards */
function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function hasKey<T extends string>(o: unknown, key: T): o is Record<T, unknown> {
  return isObj(o) && key in o;
}

/** Utöka server-typer lokalt (utan att kräva serverändringar) */
type PublicMember = BasePublicMember & {
  /** valfri – om servern inte skickar providers så renderar vi bara inget */
  providers?: string[];
};

type GroupInitial = BaseGroupInitial & {
  /** valfri – om servern inte skickar region så visar vi “—” */
  region?: string;
};

/** API-typer (klientens tolkning) */
type ApiOk = { ok: true };
type ApiErr = { ok: false; message?: string };
type Api<T> = (ApiOk & T) | ApiErr;

type MembersRespNew = {
  code: string;
  members: PublicMember[];
};
type MembersRespLegacy = {
  group: { code: string; region?: string };
  members: PublicMember[];
};

type SearchStatus = "NONE" | "PENDING_OUT" | "PENDING_IN" | "ACCEPTED";

type SearchUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  status: SearchStatus;
};

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

/** ---- API-kall (toleranta mot olika svar) ---- */

async function getMembers(code: string | null): Promise<
  Api<{ code: string; region?: string; members: PublicMember[] }>
> {
  const url = code ? `/api/group/members?code=${encodeURIComponent(code)}` : "/api/group/members";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let message = "Kunde inte ladda gruppen.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    return { ok: false, message };
  }

  try {
    const data = (await res.json()) as unknown;
    if (hasKey(data, "code") && typeof (data as { code?: unknown }).code === "string") {
      const d = data as MembersRespNew;
      return { ok: true, code: d.code, members: d.members };
    }
    if (hasKey(data, "group") && isObj((data as MembersRespLegacy).group)) {
      const d = data as MembersRespLegacy;
      return { ok: true, code: d.group.code, region: d.group.region, members: d.members };
    }
  } catch {
    return { ok: false, message: "Felaktigt svar från servern." };
  }
  return { ok: false, message: "Okänt svar." };
}

async function joinGroup(code: string): Promise<Api<{ code: string }>> {
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
    } catch {
      /* ignore */
    }
    return { ok: false, message };
  }
  try {
    const data = (await res.json()) as unknown;
    if (hasKey(data, "code") && typeof (data as { code?: unknown }).code === "string") {
      return { ok: true, code: (data as { code: string }).code };
    }
    if (hasKey(data, "group") && isObj((data as { group?: unknown }).group)) {
      const g = (data as { group: { code?: string } }).group;
      return { ok: true, code: g.code ?? "" };
    }
    if (hasKey(data, "ok") && (data as { ok: unknown }).ok === false) {
      return { ok: false, message: "Ett fel uppstod." };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, message: "Oväntat svar från servern." };
}

async function leaveGroup(): Promise<Api<{ success: true }>> {
  const res = await fetch("/api/group/leave", { method: "POST" });
  if (!res.ok) {
    let message = "Kunde inte lämna gruppen.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    return { ok: false, message };
  }
  return { ok: true, success: true };
}

async function createGroup(name?: string): Promise<Api<{ code: string }>> {
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
    } catch {
      /* ignore */
    }
    return { ok: false, message };
  }
  try {
    const data = (await res.json()) as unknown;
    if (hasKey(data, "code") && typeof (data as { code?: unknown }).code === "string") {
      return { ok: true, code: (data as { code: string }).code };
    }
    if (hasKey(data, "group") && isObj((data as { group?: unknown }).group)) {
      const g = (data as { group: { code?: string } }).group;
      return { ok: true, code: g.code ?? "" };
    }
    if (hasKey(data, "ok") && (data as { ok: unknown }).ok === false) {
      return { ok: false, message: "Ett fel uppstod." };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, message: "Oväntat svar från servern." };
}

async function friendsList(): Promise<Api<FriendsListResp>> {
  const res = await fetch("/api/friends/list", { cache: "no-store" });
  if (!res.ok) return { ok: false, message: "Kunde inte hämta vänner." };
  try {
    return (await res.json()) as Api<FriendsListResp>;
  } catch {
    return { ok: false, message: "Felaktigt svar från servern." };
  }
}

async function friendRequestById(userId: string): Promise<Api<{ requestId: string }>> {
  const res = await fetch("/api/friends/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId: userId }),
  });
  if (!res.ok) {
    try {
      const b = (await res.json()) as { message?: string };
      return { ok: false, message: b?.message ?? "Kunde inte skicka vänförfrågan." };
    } catch {
      return { ok: false, message: "Kunde inte skicka vänförfrågan." };
    }
  }
  try {
    return (await res.json()) as Api<{ requestId: string }>;
  } catch {
    return { ok: false, message: "Felaktigt svar från servern." };
  }
}

async function friendsSearch(q: string): Promise<Api<{ users: SearchUser[] }>> {
  const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) return { ok: false, message: "Sökningen misslyckades." };
  try {
    return (await res.json()) as Api<{ users: SearchUser[] }>;
  } catch {
    return { ok: false, message: "Felaktigt svar från servern." };
  }
}

/** ---- Komponent ---- */

export default function GroupClient({ initial }: { initial: GroupInitial }) {
  const [tab, setTab] = useState<"group" | "friends">("group");

  const [code, setCode] = useState<string | null>(initial.code);
  const [region, setRegion] = useState<string | undefined>(initial.region);
  const [members, setMembers] = useState<PublicMember[]>(
    Array.isArray(initial.members) ? initial.members.map((m) => ({ ...m })) : []
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  // Friends state
  const [friends, setFriends] = useState<FriendsListUser[]>([]);
  const [pendingIn, setPendingIn] = useState<{ requestId: string; from: FriendsListUser }[]>([]);
  const [pendingOut, setPendingOut] = useState<{ requestId: string; to: FriendsListUser }[]>([]);

  // Mitt userId (för att dölja +Add på mig själv)
  const [meUserId, setMeUserId] = useState<string | null>(null);

  // Search state
  const [q, setQ] = useState<string>("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Läs in nw_uid från cookies en gång
  useEffect(() => {
    const uid = getCookie("nw_uid");
    if (uid) setMeUserId(uid);
  }, []);

  // Ladda friends-listan när man går in på fliken
  useEffect(() => {
    if (tab !== "friends") return;
    (async () => {
      const resp = await friendsList();
      if (!resp.ok) {
        setError(resp.message ?? "Kunde inte hämta vänner.");
        return;
      }
      setFriends(resp.friends);
      setPendingIn(resp.pendingIn);
      setPendingOut(resp.pendingOut);
    })();
  }, [tab]);

  const refreshMembers = async () => {
    if (!code) return;
    const data = await getMembers(code);
    if (data.ok) {
      setMembers(Array.isArray(data.members) ? data.members : []);
      setRegion(data.region);
    } else {
      setError(data.message ?? "Ett fel uppstod.");
    }
  };

  const handleCreate = async (name?: string) => {
    setBusy(true);
    setError(null);
    const resp = await createGroup(name);
    setBusy(false);
    if (!resp.ok) {
      setError(resp.message ?? "Kunde inte skapa gruppen.");
      return;
    }
    setCode(resp.code);
    await refreshMembers();
  };

  const handleLeave = async () => {
    setBusy(true);
    setError(null);
    const resp = await leaveGroup();
    setBusy(false);
    if (!resp.ok) {
      setError(resp.message ?? "Kunde inte lämna gruppen.");
      return;
    }
    setCode(null);
    setMembers([]);
  };

  const handleJoin = async (groupCode: string) => {
    setBusy(true);
    setError(null);
    const resp = await joinGroup(groupCode);
    setBusy(false);
    if (!resp.ok) {
      setError(resp.message ?? "Kunde inte gå med i gruppen.");
      return;
    }
    setCode(resp.code);
    await refreshMembers();
  };

  const onCopy = async (codeToCopy: string) => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
    } catch {
      // ignore
    }
  };

  const quickAdd = async (userId: string) => {
    const resp = await friendRequestById(userId);
    if (!resp.ok) setError(resp.message ?? "Kunde inte lägga till vän.");
  };

  // Debounced search
  useEffect(() => {
    if (tab !== "friends") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const query = q.trim();
      if (!query) {
        setResults([]);
        return;
      }
      const resp = await friendsSearch(query);
      if (!resp.ok) {
        setError(resp.message ?? "Sökningen misslyckades.");
        return;
      }
      setResults(resp.users);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, tab]);

  // UI
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          className={classNames(
            "rounded-xl px-3 py-1.5 text-sm",
            tab === "group" ? "bg-neutral-800" : "bg-neutral-900 hover:bg-neutral-800"
          )}
          onClick={() => setTab("group")}
        >
          Group
        </button>
        <button
          className={classNames(
            "rounded-xl px-3 py-1.5 text-sm",
            tab === "friends" ? "bg-neutral-800" : "bg-neutral-900 hover:bg-neutral-800"
          )}
          onClick={() => setTab("friends")}
        >
          Friends
        </button>
      </div>

      {tab === "group" ? (
        <GroupTab
          code={code}
          region={region}
          members={members}
          busy={busy}
          error={error}
          onCopy={onCopy}
          onLeave={handleLeave}
          onJoin={handleJoin}
          onCreate={handleCreate}
          quickAdd={quickAdd}
          meUserId={meUserId}
          setCode={setCode}
          refreshMembers={refreshMembers}
        />
      ) : (
        <FriendsTab
          friends={friends}
          pendingIn={pendingIn}
          pendingOut={pendingOut}
          q={q}
          setQ={setQ}
          results={results}
        />
      )}
    </div>
  );
}

/** ---- Group-tab (render) ---- */

function GroupTab({
  code,
  region,
  members,
  busy,
  error,
  onCopy,
  onLeave,
  onJoin,
  onCreate,
  quickAdd,
  meUserId,
  setCode,
  refreshMembers,
}: {
  code: string | null;
  region?: string;
  members: PublicMember[];
  busy: boolean;
  error: string | null;
  onCopy: (code: string) => void;
  onLeave: () => void;
  onJoin: (code: string) => void;
  onCreate: (name?: string) => void;
  quickAdd: (userId: string) => void;
  meUserId: string | null;
  setCode: (code: string | null) => void;
  refreshMembers: () => Promise<void>;
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      {code ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm opacity-70">Active group</div>
              <div className="text-xl font-semibold">{code}</div>
              <div className="text-xs opacity-60">{region ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                onClick={() => onCopy(code)}
                title="Copy group code"
              >
                Copy code
              </button>
              <button
                className="rounded-xl border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                onClick={() => {
                  onLeave();
                  setCode(null);
                }}
                title="Leave group"
              >
                Leave
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-lg font-semibold">Members</h3>
              {members.length === 0 ? (
                <p className="text-sm text-neutral-400">Inga medlemmar ännu.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {m.displayName ?? m.username ?? "Okänd"}
                        </div>
                        {Array.isArray(m.providers) && m.providers.length > 0 ? (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {m.providers.map((p) => (
                              <span
                                key={p}
                                className="rounded-md border border-neutral-700 px-1.5 py-0.5 text-[10px] uppercase opacity-90"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {meUserId && m.userId === meUserId ? (
                          <span className="text-xs opacity-60">You</span>
                        ) : (
                          <button
                            onClick={() => quickAdd(m.userId)}
                            className="rounded-xl border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                            title="Add friend"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">Actions</h3>
              <div className="space-y-2">
                <button
                  className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
                  onClick={refreshMembers}
                  disabled={busy}
                >
                  Refresh members
                </button>
                <button
                  className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
                  onClick={() => setJoinOpen((v) => !v)}
                  disabled={busy}
                >
                  Join group
                </button>
                <button
                  className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
                  onClick={() => setCreateOpen((v) => !v)}
                  disabled={busy}
                >
                  Create group
                </button>
              </div>
            </div>
          </div>

          {joinOpen ? <JoinCard onJoin={onJoin} busy={busy} /> : null}
          {createOpen ? <CreateCard onCreate={onCreate} busy={busy} /> : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="mb-4 text-sm opacity-70">You are not in a group.</div>
          <div className="grid gap-4 md:grid-cols-2">
            <JoinCard onJoin={onJoin} busy={busy} />
            <CreateCard onCreate={onCreate} busy={busy} />
          </div>
        </div>
      )}
    </div>
  );
}

/** ---- Friends-tab (render) ---- */

function FriendsTab({
  friends,
  pendingIn,
  pendingOut,
  q,
  setQ,
  results,
}: {
  friends: FriendsListUser[];
  pendingIn: { requestId: string; from: FriendsListUser }[];
  pendingOut: { requestId: string; to: FriendsListUser }[];
  q: string;
  setQ: (q: string) => void;
  results: SearchUser[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-semibold">Search</h3>
        <input
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none"
          placeholder="Search by username…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-1 font-medium">Results</h4>
          <ul className="space-y-1">
            {results.map((u) => (
              <li key={u.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                <span className="truncate">{u.displayName ?? u.username ?? "—"}</span>
                <span className="text-xs opacity-70">{u.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-1 font-medium">Friends</h4>
          <ul className="space-y-1">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                <span className="truncate">{f.displayName ?? f.username ?? "—"}</span>
                <span className="text-xs opacity-70">Friend</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h4 className="mb-1 font-medium">Requests</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-sm opacity-70">Incoming</div>
            <ul className="space-y-1">
              {pendingIn.map((r) => (
                <li key={r.requestId} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                  <span className="truncate">{r.from.displayName ?? r.from.username ?? "—"}</span>
                  <span className="text-xs opacity-70">Pending</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1 text-sm opacity-70">Outgoing</div>
            <ul className="space-y-1">
              {pendingOut.map((r) => (
                <li key={r.requestId} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                  <span className="truncate">{r.to.displayName ?? r.to.username ?? "—"}</span>
                  <span className="text-xs opacity-70">Pending</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---- Små kort ---- */

function JoinCard({ onJoin, busy }: { onJoin: (code: string) => void; busy: boolean }) {
  const [code, setCode] = useState("");
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="mb-2 text-sm opacity-70">Join an existing group</div>
      <input
        className="mb-2 w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none"
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
  const [name, setName] = useState("");
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="mb-2 text-sm opacity-70">Create a new group</div>
      <input
        className="mb-2 w-full rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm outline-none"
        placeholder="Group name (optional)…"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        onClick={() => onCreate(name.trim() || undefined)}
        disabled={busy}
        className="rounded-2xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        Create
      </button>
    </div>
  );
}
