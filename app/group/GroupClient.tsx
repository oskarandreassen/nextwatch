"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

type IncomingInvite = {
  id: string;
  groupCode: string;
  from: { id: string; username: string | null; displayName: string | null };
  createdAt: string | Date;
};

/** ---------- API helpers ---------- */
async function parseFriendsList(res: Response): Promise<Api<FriendsListResp>> {
  if (!res.ok) return { ok: false, message: "Kunde inte hämta vänner." };
  try {
    const data = (await res.json()) as unknown;

    if (isRecord(data)) {
      const friendsRaw = has(data, "friends") && Array.isArray(data.friends) ? data.friends : [];
      const inRaw = has(data, "pendingIn") && Array.isArray(data.pendingIn) ? data.pendingIn : [];
      const outRaw = has(data, "pendingOut") && Array.isArray(data.pendingOut) ? data.pendingOut : [];

      const friends: FriendsListUser[] = friendsRaw
        .filter(isRecord)
        .map((row) => {
          if (isRecord(row.other)) {
            const other = row.other as Record<string, unknown>;
            return {
              id: String(other.id ?? ""),
              username: (other.username ?? null) as string | null,
              displayName: (other.displayName ?? null) as string | null,
            };
          }
          return {
            id: String(row.id ?? row.userId ?? ""),
            username: (row.username ?? null) as string | null,
            displayName: (row.displayName ?? null) as string | null,
          };
        })
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

async function createGroup(name?: string): Promise<Api<{ code: string }>> {
  const res = await fetch("/api/group/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
  if (!res.ok) return { ok: false, message: "Kunde inte skapa gruppen." };
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

/** UPDATED: stöder {incoming} (nytt) + {invites} (legacy) och returnerar { invites } */
async function listIncomingInvites(): Promise<Api<{ invites: IncomingInvite[] }>> {
  const res = await fetch("/api/group/invite/list", { cache: "no-store" });
  if (!res.ok) return { ok: false, message: "Kunde inte hämta invites." };
  try {
    const data = (await res.json()) as unknown;

    const invites: IncomingInvite[] = [];
    // Nytt format
    if (isRecord(data) && Array.isArray((data as Record<string, unknown>).incoming)) {
      const inc = (data as Record<string, unknown>).incoming as Array<Record<string, unknown>>;
      for (const r of inc) {
        const status = String(r.status ?? "pending");
        if (status !== "pending") continue;
        const fromObj = isRecord(r.from) ? (r.from as Record<string, unknown>) : undefined;
        invites.push({
          id: String(r.id ?? ""),
          groupCode: String(r.groupCode ?? ""),
          createdAt: String(r.createdAt ?? new Date().toISOString()),
          from: {
            id: String(fromObj?.id ?? ""),
            username: (fromObj?.username ?? null) as string | null,
            displayName: (fromObj?.displayName ?? null) as string | null,
          },
        });
      }
      return { ok: true, invites };
    }
    // Legacy
    if (isRecord(data) && Array.isArray((data as Record<string, unknown>).invites)) {
      const raw = (data as Record<string, unknown>).invites as Array<Record<string, unknown>>;
      for (const r of raw) {
        const fromObj = isRecord(r.from) ? (r.from as Record<string, unknown>) : undefined;
        invites.push({
          id: String(r.id ?? ""),
          groupCode: String(r.groupCode ?? ""),
          createdAt: String(r.createdAt ?? new Date().toISOString()),
          from: {
            id: String(fromObj?.id ?? ""),
            username: (fromObj?.username ?? null) as string | null,
            displayName: (fromObj?.displayName ?? null) as string | null,
          },
        });
      }
      return { ok: true, invites };
    }
    return { ok: false, message: "Felaktigt svar." };
  } catch {
    return { ok: false, message: "Kunde inte tolka svar." };
  }
}

async function sendInvite(toUserId: string): Promise<Api<{ requestId: string }>> {
  const res = await fetch("/api/group/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId }),
  });
  try {
    const data = (await res.json()) as unknown;
    if (!res.ok) {
      const msg = isRecord(data) && typeof data.message === "string" ? data.message : "Invite failed.";
      return { ok: false, message: msg };
    }
    if (isRecord(data) && data.ok === true) {
      return { ok: true, requestId: String((data as Record<string, unknown>).requestId ?? "") };
    }
    return { ok: false, message: "Invite failed." };
  } catch {
    return { ok: false, message: "Invite failed." };
  }
}

/** UPDATED: skickar { id, action } (server förväntar det) */
async function respondInvite(
  inviteId: string,
  action: "accept" | "decline"
): Promise<Api<{ joined?: string; declined?: boolean }>> {
  const res = await fetch("/api/group/invite/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: inviteId, action }),
  });
  try {
    const data = (await res.json()) as unknown;
    if (!res.ok) {
      const msg = isRecord(data) && typeof data.message === "string" ? data.message : "Failed.";
      return { ok: false, message: msg };
    }
    if (isRecord(data) && data.ok === true) {
      const joined = (data as Record<string, unknown>).joined as string | undefined;
      const declined = (data as Record<string, unknown>).declined as boolean | undefined;
      return { ok: true, joined, declined };
    }
    return { ok: false, message: "Failed." };
  } catch {
    return { ok: false, message: "Failed." };
  }
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

  // set med vänners id för Group-tabben (dölja +Add)
  const [friendsIdSet, setFriendsIdSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Hämta en gång vid mount så Group-tab kan dölja +Add för befintliga vänner
    (async () => {
      const r = await friendsList();
      if (r.ok) {
        setFriendsIdSet(new Set((r.friends ?? []).map((u) => u.id)));
      }
    })();
  }, []);

  // local UX markers
  const [sentToIds, setSentToIds] = useState<Set<string>>(new Set());
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // search (Friends tab UI - placeholder)
  const [q, setQ] = useState<string>("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState<boolean>(false);

  // Incoming invite popup
  const [incoming, setIncoming] = useState<IncomingInvite | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  // load members (stabiliserad med useCallback för dependency-säkerhet)
  const refreshMembers = useCallback(async () => {
    if (!code) return;
    const data = await getMembers(code);
    if (data.ok) {
      setMembers(Array.isArray(data.members) ? data.members : []);
      setRegion(data.region);
    }
  }, [code]);

  // Auto-refresh medlemmar var 5s när i aktiv grupp
  useEffect(() => {
    if (!code || tab !== "group") return;
    const timer = setInterval(() => {
      void refreshMembers();
    }, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [code, tab, refreshMembers]);

  // switch tabs → load friends lists
  useEffect(() => {
    if (tab !== "friends") return;
    (async () => {
      const resp = await friendsList();
      if (!resp.ok) {
        setError(resp.message ?? "Kunde inte hämta vänner.");
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

  // Basic create / join / leave
  const handleCreate = async (name?: string) => {
    setBusy(true);
    setError(null);
    const resp = await createGroup(name);
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
    setSentToIds((prev) => new Set(prev).add(userId));
  };

  // Debounced search (placeholder; koppla på din /api/friends/search om/när du vill)
  useEffect(() => {
    if (tab !== "friends") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const query = q.trim();
      if (!query) {
        setResults([]);
        return;
      }
      setResults([]);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, tab]);

  // Poll för inkommande invites var 5s (visar popup EN i taget)
  useEffect(() => {
    const timer = setInterval(async () => {
      const r = await listIncomingInvites();
      if (!r.ok) return;
      const arr = r.invites ?? [];
      const firstNew = arr.find((i) => !seenRef.current.has(i.id));
      if (firstNew) {
        setIncoming(firstNew);
        seenRef.current.add(firstNew.id);
      }
    }, 5000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Tabs */}
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
          sentToIds={sentToIds}
          pendingOutIds={new Set(pendingOut.map((r) => r.to.id))}
          inviteOpen={inviteOpen}
          setInviteOpen={setInviteOpen}
          invitedIds={invitedIds}
          setInvitedIds={setInvitedIds}
          friendsIdSet={friendsIdSet}
        />
      ) : (
        <FriendsTab friends={friends} pendingIn={pendingIn} pendingOut={pendingOut} q={q} setQ={setQ} results={results} />
      )}

      {/* Incoming invite popup */}
      {incoming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="mb-3 text-center text-sm opacity-70">Group invite</div>
            <div className="mb-3 text-center text-base">
              <span className="font-semibold">{incoming.from.displayName ?? incoming.from.username ?? "Someone"}</span>{" "}
              has invited you to group <span className="font-mono">{incoming.groupCode}</span>.
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                className="rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
                onClick={async () => {
                  const r = await respondInvite(incoming.id, "accept");
                  if (r.ok) {
                    setCode(r.joined ?? null);
                    setIncoming(null);
                  }
                }}
              >
                Accept
              </button>
              <button
                className="rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-500"
                onClick={async () => {
                  const r = await respondInvite(incoming.id, "decline");
                  if (r.ok) setIncoming(null);
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  sentToIds,
  pendingOutIds,
  inviteOpen,
  setInviteOpen,
  invitedIds,
  setInvitedIds,
  friendsIdSet,
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
  sentToIds: Set<string>;
  pendingOutIds: Set<string>;
  inviteOpen: boolean;
  setInviteOpen: (v: boolean) => void;
  invitedIds: Set<string>;
  setInvitedIds: (s: Set<string>) => void;
  friendsIdSet: Set<string>;
}) {
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
              <button
                className="rounded-xl border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                onClick={() => setInviteOpen(true)}
                title="Invite friends"
              >
                Invite friends
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-lg font-semibold">Members</h3>
            {members.length === 0 ? (
              <p className="text-sm text-neutral-400">Inga medlemmar ännu.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => {
                  const isMe = meUserId && m.userId === meUserId;
                  const alreadySent = sentToIds.has(m.userId) || pendingOutIds.has(m.userId);
                  const isFriend = friendsIdSet.has(m.userId);
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
                        ) : isFriend ? (
                          <span className="text-xs opacity-70">Friend</span>
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

          {/* Invite modal */}
          {inviteOpen ? <InviteModal onClose={() => setInviteOpen(false)} invitedIds={invitedIds} setInvitedIds={setInvitedIds} /> : null}
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

/** ---------- Invite Modal ---------- */
function InviteModal({
  onClose,
  invitedIds,
  setInvitedIds,
}: {
  onClose: () => void;
  invitedIds: Set<string>;
  setInvitedIds: (s: Set<string>) => void;
}) {
  const [friends, setFriends] = useState<FriendsListUser[]>([]);
  const [pendingOut, setPendingOut] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await friendsList();
      if (!r.ok) {
        setError(r.message ?? "Kunde inte hämta vänner.");
        return;
      }
      setFriends(r.friends ?? []);
      setPendingOut(new Set((r.pendingOut ?? []).map((x) => x.to.id)));
    })();
  }, []);

  const doInvite = async (uid: string) => {
    const r = await sendInvite(uid);
    if (!r.ok) {
      setError(r.message ?? "Invite failed.");
      return;
    }
    const next = new Set(invitedIds);
    next.add(uid);
    setInvitedIds(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm opacity-70">Invite friends</div>
          <button className="rounded-lg border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <div className="mb-2 rounded-md border border-red-800 bg-red-950/30 p-2 text-xs text-red-200">{error}</div> : null}

        {friends.length === 0 ? (
          <div className="py-8 text-center text-sm opacity-70">No friends to invite.</div>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-auto">
            {friends.map((f) => {
              const already = invitedIds.has(f.id) || pendingOut.has(f.id);
              return (
                <li key={f.id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                  <span className="truncate">{f.displayName ?? f.username ?? "—"}</span>
                  {already ? (
                    <span className="rounded-md border border-neutral-700 px-2 py-1 text-xs opacity-70">Invited</span>
                  ) : (
                    <button
                      className="rounded-xl border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                      onClick={() => void doInvite(f.id)}
                      title="Invite to group"
                    >
                      Invite
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** ---------- Friends tab (UI polish, samma logik) ---------- */
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
          <h4 className="mb-1 font-medium">Friends</h4>
          {friends.length === 0 ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-4 text-sm opacity-70">No friends yet.</div>
          ) : (
            <ul className="space-y-1">
              {friends.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                  <span className="truncate">{f.displayName ?? f.username ?? "—"}</span>
                  <span className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] opacity-70">Friend</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 font-medium">Incoming</div>
            {pendingIn.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-3 text-sm opacity-70">No requests.</div>
            ) : (
              <ul className="space-y-1">
                {pendingIn.map((r) => (
                  <li key={r.requestId} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                    <span className="truncate">{r.from.displayName ?? r.from.username ?? "—"}</span>
                    <span className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] opacity-70">Pending</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-1 font-medium">Outgoing</div>
            {pendingOut.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 px-3 py-3 text-sm opacity-70">No requests.</div>
            ) : (
              <ul className="space-y-1">
                {pendingOut.map((r) => (
                  <li key={r.requestId} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                    <span className="truncate">{r.to.displayName ?? r.to.username ?? "—"}</span>
                    <span className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] opacity-70">Pending</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Results list (placeholder UI) */}
      {results.length > 0 ? (
        <div>
          <h4 className="mb-1 font-medium">Results</h4>
          <ul className="space-y-1">
            {results.map((u) => (
              <li key={u.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
                <span className="truncate">{u.displayName ?? u.username ?? "—"}</span>
                <span className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] opacity-70">{u.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
