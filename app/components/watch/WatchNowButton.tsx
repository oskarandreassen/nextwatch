'use client';

type Props = {
  url?: string;
  disabledText?: string;
};

export default function WatchNowButton({ url, disabledText = 'Ej tillgänglig' }: Props) {
  const enabled = Boolean(url);
  return (
    <a
      href={enabled ? url : undefined}
      target={enabled ? '_blank' : undefined}
      rel={enabled ? 'noopener noreferrer' : undefined}
      aria-disabled={!enabled}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition
        ${enabled ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'}
      `}
    >
      {enabled ? 'Kolla nu' : disabledText}
    </a>
  );
}
