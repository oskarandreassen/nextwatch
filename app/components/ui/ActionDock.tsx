"use client";

import { X, Info, Bookmark, Heart } from "lucide-react";

type VibratingNavigator = Navigator & {
  vibrate?: (pattern: number | number[]) => boolean;
};

type Props = {
  onNope: () => void;
  onInfo: () => void;
  onWatchlist: () => void;
  onLike: () => void;
  disabled?: boolean;
};

function vib(ms = 30) {
  if (typeof navigator !== "undefined") {
    (navigator as VibratingNavigator).vibrate?.(ms);
  }
}

function RoundBtn({
  title,
  intent,
  onClick,
  disabled,
  children,
}: {
  title: string;
  intent: "danger" | "info" | "save" | "like";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    intent === "danger"
      ? "border-red-500/40 bg-red-600/20 hover:bg-red-600/30"
      : intent === "info"
      ? "border-blue-500/40 bg-blue-600/20 hover:bg-blue-600/30"
      : intent === "save"
      ? "border-violet-500/40 bg-violet-600/20 hover:bg-violet-600/30"
      : "border-green-500/40 bg-green-600/20 hover:bg-green-600/30";

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-full border text-white shadow-md backdrop-blur transition disabled:opacity-60 md:h-12 md:w-12 ${cls}`}
    >
      {children}
    </button>
  );
}

export default function ActionDock({
  onNope,
  onInfo,
  onWatchlist,
  onLike,
  disabled,
}: Props) {
  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+68px)] z-30 mx-auto mt-4 flex w-full max-w-[520px] items-center justify-center gap-5 px-4 md:static md:bottom-0 md:mt-6">
      <RoundBtn
        title="Nope"
        intent="danger"
        disabled={disabled}
        onClick={() => {
          vib(18);
          onNope();
        }}
      >
        <X className="h-7 w-7" />
      </RoundBtn>

      <RoundBtn title="Info" intent="info" disabled={disabled} onClick={onInfo}>
        <Info className="h-7 w-7" />
      </RoundBtn>

      <RoundBtn
        title="Watchlist"
        intent="save"
        disabled={disabled}
        onClick={() => {
          vib(22);
          onWatchlist();
        }}
      >
        <Bookmark className="h-7 w-7" />
      </RoundBtn>

      <RoundBtn
        title="Like"
        intent="like"
        disabled={disabled}
        onClick={() => {
          vib(28);
          onLike();
        }}
      >
        <Heart className="h-7 w-7" />
      </RoundBtn>
    </div>
  );
}
