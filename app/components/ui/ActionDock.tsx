"use client";

import { Heart, Info, X, Bookmark } from "lucide-react";
import clsx from "clsx";


import { notify } from "@/app/components/lib/notify"; // eller relativt beroende på filens plats
// efter lyckad POST /api/watchlist/toggle → added:
notify("Added to Watchlist");
// om borttagen:
notify("Removed from Watchlist");


type Props = {
  onNope: () => void;
  onInfo: () => void;
  onwatchlist: () => void;
  onLike: () => void;
  className?: string;
  disabled?: boolean;
};

function RoundBtn({
  onClick,
  title,
  children,
  intent,
  disabled,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  intent: "danger" | "info" | "save" | "like";
  disabled?: boolean;
}) {
  const color = {
    danger: "bg-red-600/20 border-red-500/40 hover:bg-red-600/30",
    info:   "bg-blue-600/20 border-blue-500/40 hover:bg-blue-600/30",
    save:   "bg-violet-600/20 border-violet-500/40 hover:bg-violet-600/30",
    like:   "bg-green-600/20 border-green-500/40 hover:bg-green-600/30",
  }[intent];

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "h-14 w-14 rounded-full border backdrop-blur transition-colors",
        "flex items-center justify-center",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        color
      )}
    >
      {children}
    </button>
  );
}

export default function ActionDock({
  onNope,
  onInfo,
  onwatchlist,
  onLike,
  className,
  disabled,
}: Props) {
  return (
    <div
      className={clsx(
        "mx-auto mt-3 flex max-w-md items-center justify-center gap-3",
        className
      )}
      aria-label="Kortåtgärder"
    >
      <RoundBtn onClick={onNope} title="Nej" intent="danger" disabled={disabled}>
        <X className="h-7 w-7" />
      </RoundBtn>
      <RoundBtn onClick={onInfo} title="Info" intent="info" disabled={disabled}>
        <Info className="h-7 w-7" />
      </RoundBtn>
      <RoundBtn onClick={onwatchlist} title="watchlist" intent="save" disabled={disabled}>
        <Bookmark className="h-7 w-7" />
      </RoundBtn>
      <RoundBtn onClick={onLike} title="Ja" intent="like" disabled={disabled}>
        <Heart className="h-7 w-7" />
      </RoundBtn>
    </div>
  );
}
