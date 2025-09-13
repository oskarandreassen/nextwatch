"use client";

import { useEffect, useState } from "react";

type VibratingNavigator = Navigator & {
  vibrate?: (pattern: number | number[]) => boolean;
};

export default function Toast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const m = (e as CustomEvent<string>).detail;
      setMsg(m);
      if (typeof navigator !== "undefined") {
        (navigator as VibratingNavigator).vibrate?.(30);
      }
      setTimeout(() => setMsg(null), 1500);
    };
    window.addEventListener("app:toast", on as EventListener);
    return () => window.removeEventListener("app:toast", on as EventListener);
  }, []);

  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow">
        {msg}
      </div>
    </div>
  );
}
