'use client';

import { useEffect, useState } from 'react';

export interface InviteUser {
  id: string;
  username: string | null;
  displayName?: string | null;
}

export interface Invite {
  id: string;
  groupCode: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  from: InviteUser; // den som skickade
}

export interface InviteList {
  ok: boolean;
  incoming: Invite[];
  outgoing: Invite[];
}

export function useGroupInvites(pollMs = 5000) {
  const [data, setData] = useState<InviteList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;

    const tick = async () => {
      try {
        const r = await fetch('/api/group/invite/list', { cache: 'no-store' });
        const j: InviteList = await r.json();
        if (!stop) {
          setData(j);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!stop) {
          setError('fetch_failed');
          setLoading(false);
        }
      } finally {
        if (!stop) setTimeout(tick, pollMs);
      }
    };

    tick();
    return () => {
      stop = true;
    };
  }, [pollMs]);

  return { data, loading, error };
}
