"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MediaType = "movie" | "tv";

export type ProviderLink = {
  name: string;
  url: string;
};

export type GroupMatchItem = {
  tmdbId: number;
  tmdbType: MediaType;
  title: string;
  year?: number;
  rating?: number;
  poster?: string;
  overview?: string;
  providers?: ProviderLink[];
};

type GroupMatchResponse =
  | {
      ok: true;
      size: number; // group members
      need: number; // threshold
      count: number; // current likes for top candidate
      match: GroupMatchItem | null;
      matches?: GroupMatchItem[];
    }
  | {
      ok: false;
      error: string;
    };

function getCookieValue(name: string): string | undefined {
  const parts = document.cookie.split(";").map((x) => x.trim());
  const found = parts.find((p) => p.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.split("=", 2)[1]) : undefined;
}

export function useGroupMatchPolling() {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<GroupMatchItem | null>(null);
  const [groupCode, setGroupCode] = useState<string | undefined>(undefined);

  const timerRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    setGroupCode(getCookieValue("nw_group"));
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    if (!groupCode || busyRef.current) return;
    busyRef.current = true;
    try {
      const url = `/api/group/match?code=${encodeURIComponent(groupCode)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        busyRef.current = false;
        return;
      }
      const data = (await res.json()) as GroupMatchResponse;
      if ("ok" in data && data.ok && data.match) {
        setItem(data.match);
        setOpen(true);
      }
    } catch {
      // silent
    } finally {
      busyRef.current = false;
    }
  }, [groupCode]);

  const start = useCallback(() => {
    if (!groupCode) return;
    if (timerRef.current !== null) return;
    void fetchOnce();
    timerRef.current = window.setInterval(fetchOnce, 2_000);
  }, [fetchOnce, groupCode]);

  useEffect(() => {
    if (!groupCode) return;
    start();
    return stop;
  }, [groupCode, start, stop]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchOnce();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchOnce]);

  const dismiss = useCallback(() => {
    setOpen(false);
    setItem(null);
  }, []);

  const notifyVoted = useCallback(() => {
    // trigga en extra koll direkt när någon röstat
    void fetchOnce();
  }, [fetchOnce]);

  return useMemo(
    () => ({
      open,
      item,
      dismiss,
      notifyVoted,
      hasGroup: Boolean(groupCode),
    }),
    [dismiss, item, notifyVoted, open, groupCode]
  );
}
