"use client";

import { useEffect, useRef, useState } from "react";

/** ---------- helpers ---------- */
function cx(...xs: string[]): string {
  return xs.filter(Boolean).join(" ");
}
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function has<T extends string>(o: unknown, key: T): o is Record<T, unknown> {
  return isRecord(o) && key in o;
}

/** ---------- types (klient) ---------- */
// Dessa två bas-typerna speglar dina server-props. Behållna för UI-kompabilitet.
type PublicMember = {
  userId: string;
  username: string | null;
  displayName: string | null;
  providers?: string[];
};
type GroupInitial = {
  code: string | null;
  region?: string;
  members: PublicMember[];
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

type ApiOk = { ok: true };
type ApiErr = { ok: false; message?: string };
type Api<T> = (ApiOk & T) | ApiErr;

type SearchStatus = "NONE" | "PENDING_OUT" | "PENDING_IN" | "ACCEPTED";
type SearchUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  status: SearchStatus;
};

/** ---------- API (tolerant parsing) ---------- */
async function parseFriendsList(res: Response): Promise<Api<FriendsListResp>> {
  if (!res.ok) return { ok: false, message: "Kunde inte hämta vänner." };
  try {
    const data = (await res.json()) as unknown;

    // Förväntad ny form: { ok:true, friends:[{ other:{...} }], pendingIn:[], pendingOut:[] }
    // Äldre platt form stöds också.
    if (isRecord(data)) {
      const friendsRaw = has(data, "friends") && Array.isArray(data.friends) ? data.friends : [];
      const inRaw = has(data, "pendingIn") && Array.isArray(data.pendingIn) ? data.pendingIn : [];
      const outRaw = has(data, "pendingOut") && Array.isArray(data.pendingOut) ? data.pendingOut : [];

      const friends: FriendsListUser[] = friendsRaw
        .filter(isRecord)
        .map((row) => {
          // Ny: rad.other finns
          if (isRecord(row.other)) {
            const other = row.other as Record<string, unknown>;
            return {
              id: String(other.id ?? ""),
              username: (other.username ?? null) as string | null,
              displayName: (other.displayName ?? null) as string | null,
            };
          }
          // Platt fallback
          return {
            id: String(row.id ?? row.userId ?? ""),
            username: (row.username ?? null) as string | null,
            displayName: (row.displayName ?? null) as string | null,
          };
        })
               // filtrera bort tomma id
        .filter((u) => u.id.length > 0);

      const pendingIn = inRaw
        .filter(isRecord)
        .map((r) => ({
          requestId: String(r.requestId ?? r.id ?? ""),
          from: isRecord(r.from)
            ? {
                id: String((r.from as Record<string, unknown>).id ?? ""),
                username: ((r.from as Record<string, unknown>).username ?? null) as string | null,
                displayName: ((r.from as Record<string, unknown>).displayName ?? null) as string | null,
              }
            : {
                id: String((r as Record<string, unknown>).fromUserId ?? ""),
                username: null,
                displayName: null,
              },
        }))
        .filter((r) => r.requestId.length > 0 && r.from.id.length > 0);

      const pendingOut = outRaw
        .filter(isRecord)
        .map((r) => ({
          requestId: String(r.requestId ?? r.id ?? ""),
          to: isRecord(r.to)
            ? {
                id: String((r.to as Record<string, unknown>).id ?? ""),
                username: ((r.to as Record<string, unknown>).username ?? null) as string | null,
                displayName: ((r.to as Record<string, unknown>).displayName ?? null) as string | null,
              }
            : {
                id: String((r as Record<string, unknown>).toUserId ?? ""),
                username: null,
                displayName: null,
              },
        }))
        .filter((r) => r.requestId.length > 0 && r.to.id.length > 0);

      return { ok: true, friends, pendingIn, pendingOut };
    }

    // Äldre: rent array-svar
    if (Array.isArray(data)) {
      const friends: FriendsListUser[] = data
        .filter(isRecord)
        .map((u) => ({
          id: String(u.id ?? ""),
          username: (u.username ?? null) as string | null,
          displayName: (u.displayName ?? null) as string | null,
        }))
        .filter((u) => u.id.length > 0);
      return { ok: true, friends, pendingIn: [], pendingOut: [] };
    }

    return { ok: false, message: "Felaktigt svar." };
  } catch {
    return { ok: false, message: "Kunde inte tolka svar." };
  }
}

async function friendsList(): Promise<Api<FriendsListResp>> {
  const res = await fetch("/api/friends/list", { cache: "no-store" });
  return parseFriendsList(res);
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
    const data = (await res.json()) as unknown;
    if (isRecord(data) && data.ok === true) {
      const requestId = String((data as Record<string, unknown>).requestId ?? "");
      return { ok: true, requestId: requestId || "pending" };
    }
    return { ok: false, message: "Oväntat svar." };
  } catch {
    return { ok: false, message: "Kunde inte tolka svar." };
  }
}

async function getMembers(code: string | null): Promise<
  Api<{ code: string; region?: string; members: PublicMember[] }>
> {
  const url = code ? `/api/group/members?code=${encodeURIComponent(code)}` : "/api/group/members";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { ok: false, message: "Kunde inte ladda gruppen." };
  try {
    const data = (await res.json()) as unknown;
    if (isRecord(data) && typeof data.code === "string") {
      return { ok: true, code: data.code, region: (data.region as string | undefined) ?? undefined, members: (data.members as PublicMember[]) ?? [] };
    }
    if (isRecord(data) && isRecord(data.group) && typeof data.group.code === "string") {
      return {
        ok: true,
        code: String(data.group.code),
        region: (data.group.region as string | undefined) ?? undefined,
        members: (data.members as PublicMember[]) ?? [],
      };
    }
    return { ok: false, message: "Felaktigt svar." };
  } catch {
    return { ok: false, message: "Kunde inte tolka svar." };
  }
}

async function joinGroup(code: string): Promise<Api<{ code: string }>> {
  const res = await fetch("/api/group/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) return { ok: false, message: "Kunde inte gå med i grupp." };
  try {
    const data = (await res.json()) as unknown;
    if (isRecord(data) && typeof data.code === "string") return { ok: true, code: data.code };
    if (isRecord(data) && isRecord(data.group) && typeof data.group.code === "string") {
      return { ok: true, code: String(data.group.code) };
    }
    return { ok: false, message: "Felaktigt svar." };
  } catch {
    return { ok: false, message: "Kunde inte tolka svar." };
  }
}

async function leaveGroup(): Promise<Api<{ success: true }>> {
  const res = await fetch("/api/group/leave", { method: "POST" });
  if (!res.ok) return { ok: false, message: "Kunde inte lämna gruppen." };
  return { ok: true, success: true };
}

/** ---------- component ---------- */
export default function GroupClient({ initial }: { initial: GroupInitial }) {
  const [tab, setTab] = useState<"group" | "friends">("group");

  const [code, setCode] = useState<string | null>(initial.code);
  const [region, setRegion] = useState<string | undefined>(initial.region);
  const [members, setMembers] = useState<PublicMember[]>(Array.isArray(initial.members) ? initial.members : []);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  // current user
  const [meUserId, setMeUserId] = useState<string | null>(null);
  useEffect(() => {
    const uid = getCookie("nw_uid");
    if (uid) setMeUserId(uid);
  }, []);

  // friends lists
  const [friends, setFriends] = useState<FriendsListUser[]>([]);
  const [pendingIn, setPendingIn] = useState<{ requestId: string; from: FriendsListUser }[]>([]);
  const [pendingOut, setPendingOut] = useState<{ requestId: string; to: FriendsListUser }[]>([]);

  // local UX marker: requests we just sent from Group-tab
  const [sentToIds, setSentToIds] = useState<Set<string>>(new Set());

  // search
  const [q, setQ] = useState<string>("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load members
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

  // switch tabs → load friends lists
  useEffect(() => {
    if (tab !== "friends") return;
    (async () => {
      const resp = await friendsList();
      if (!resp.ok) {
        setError(resp.message ?? "Kunde inte hämta vänner.");
        // defensiva defaults (förhindra map på undefined)
        setFriends([]);
        setPendingIn([]);
        setPendingOut([]);
        return;
      }
      setFriends(resp.friends ?? []);
      setPendingIn(resp.pendingIn ?? []);
      setPendingOut(resp.pendingOut ?? []);
    })();
  }, [tab]);

  const handleCreate = async (name?: string) => {
    setBusy(true);
    setError(null);
    const resp = await joinGroup(name ?? "");
    setBusy(false);
    if (!resp.ok) return setError(resp.message ?? "Kunde inte skapa gruppen.");
    setCode(resp.code);
    await refreshMembers();
  };

  const actuallyLeave = async () => {
    setBusy(true);
    setError(null);
    const resp = await leaveGroup();
    setBusy(false);
    if (!resp.ok) return setError(resp.message ?? "Kunde inte lämna gruppen.");
    setCode(null);
    setMembers([]);
  };

  const handleLeave = async () => {
    await actuallyLeave();
  };

  const handleJoin = async (groupCode: string) => {
    setBusy(true);
    setError(null);
    const resp = await joinGroup(groupCode);
    setBusy(false);
    if (!resp.ok) return setError(resp.message ?? "Kunde inte gå med i gruppen.");
    setCode(resp.code);
    await refreshMembers();
  };

  const onCopy = async (codeToCopy: string) => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
    } catch {
      /* ignore */
    }
  };

  const quickAdd = async (userId: string) => {
    const resp = await friendRequestById(userId);
    if (!resp.ok) {
      setError(resp.message ?? "Kunde inte lägga till vän.");
      return;
    }
    // Markera direkt i UI
    setSentToIds((prev) => new Set(prev).add(userId));
  };

  // Debounced search (placeholder; koppla på din /api/friends/search när du vill)
  useEffect(() => {
    if (tab !== "friends") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const query = q.trim();
      if (!query) {
        setResults([]);
        return;
      }
      // TODO: koppla till /api/friends/search
      setResults([]);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, tab]);

  /** --------- auto-leave: 15 min inaktivitet --------- */
  useEffect(() => {
    if (!code) return;

    let last = Date.now();
    let t: ReturnType<typeof setTimeout> | null = null;

    const poke = () => {
      last = Date.now();
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        const diff = Date.now() - last;
        if (diff >= 15 * 60 * 1000) {
          await actuallyLeave();
        }
      }, 15 * 60 * 1000 + 1000);
    };

    const onActivity = () => poke();
    const onVis = () => poke();

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity);
    document.addEventListener("visibilitychange", onVis);

    poke(); // start

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVis);
      if (t) clearTimeout(t);
    };
  }, [code]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          className={cx("rounded-xl px-3 py-1.5 text-sm", tab === "group" ? "bg-neutral-800" : "bg-neutral-900 hover:bg-neutral-800")}
          onClick={() => setTab("group")}
        >
          Group
        </button>
        <button
          className={cx("rounded-xl px-3 py-1.5 text-sm", tab === "friends" ? "bg-neutral-800" : "bg-neutral-900 hover:bg-neutral-800")}
          onClick={() => setTab("friends")}
        >
          Friends
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      {tab === "group" ? (
        <GroupTab
          code={code}
          region={region}
          members={members}
          busy={busy}
          onCopy={onCopy}
          onLeave={handleLeave}
          onJoin={handleJoin}
          onCreate={handleCreate}
          quickAdd={quickAdd}
          meUserId={meUserId}
          setCode={setCode}
          refreshMembers={refreshMembers}
          sentToIds={sentToIds}
          pendingOutIds={new Set(pendingOut.map((r) => r.to.id))}
        />
      ) : (
        <FriendsTab friends={friends} pendingIn={pendingIn} pendingOut={pendingOut} q={q} setQ={setQ} results={results} />
      )}
    </div>
  );
}

/** ---------- Group tab ---------- */
function GroupTab({
  code,
  region,
  members,
  busy,
  onCopy,
  onLeave,
  onJoin,
  onCreate,
  quickAdd,
  meUserId,
  setCode,
  refreshMembers,
  sentToIds,
  pendingOutIds,
}: {
  code: string | null;
  region?: string;
  members: PublicMember[];
  busy: boolean;
  onCopy: (code: string) => void;
  onLeave: () => void;
  onJoin: (code: string) => void;
  onCreate: (name?: string) => void;
  quickAdd: (userId: string) => void;
  meUserId: string | null;
  setCode: (code: string | null) => void;
  refreshMembers: () => Promise<void>;
  sentToIds: Set<string>;
  pendingOutIds: Set<string>;
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
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
                  {members.map((m) => {
                    const isMe = meUserId && m.userId === meUserId;
                    const alreadySent = sentToIds.has(m.userId) || pendingOutIds.has(m.userId);
                    return (
                      <li key={m.userId} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{m.displayName ?? m.username ?? "—"}</div>
                          {Array.isArray(m.providers) && m.providers.length > 0 ? (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {m.providers.map((p) => (
                                <span key={p} className="rounded-md border border-neutral-700 px-1.5 py-0.5 text-[10px] uppercase opacity-90">
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {isMe ? (
                            <span className="text-xs opacity-60">You</span>
                          ) : alreadySent ? (
                            <span className="text-xs opacity-70">Request sent</span>
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
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">Actions</h3>
              <div className="space-y-2">
                <button className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800" onClick={refreshMembers} disabled={busy}>
                  Refresh members
                </button>
                <button className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800" onClick={() => setJoinOpen((v) => !v)} disabled={busy}>
                  Join group
                </button>
                <button className="w-full rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800" onClick={() => setCreateOpen((v) => !v)} disabled={busy}>
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

/** ---------- Friends tab ---------- */
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
  // all .map kör på arrayer som defaultas till []
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

/** ---------- small cards ---------- */
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
      <button onClick={() => onJoin(code)} disabled={busy} className="rounded-2xl bg-violet-600 px-4 py-2 text-white hover:bg-violet-500 disabled:opacity-60">
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
      <button onClick={() => onCreate(name.trim() || undefined)} disabled={busy} className="rounded-2xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-60">
        Create
      </button>
    </div>
  );
}
