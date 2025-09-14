'use client';

import * as React from 'react';

const IMAGES: string[] = [
  // lätta tmdb-posterexempel – kan bytas mot dina egna
  'https://image.tmdb.org/t/p/w342/ifRFLx83Xk1DcwAS3OScgI6HmWO.jpg',
  'https://image.tmdb.org/t/p/w342/8QVDXDiOGHRcAD4oM6MXjE0osSj.jpg',
  'https://image.tmdb.org/t/p/w342/628Dep6AxEtDxjZoGP78TsOxYbK.jpg',
  'https://image.tmdb.org/t/p/w342/kqjL17yufvn9OVLyXYpvtyrFfak.jpg',
  'https://image.tmdb.org/t/p/w342/9X7YweCJw3q8Mcf6GadxReFEksM.jpg',
  'https://image.tmdb.org/t/p/w342/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg',
];

export default function HeroReel() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/80" />
      <div className="animate-[scrollX_40s_linear_infinite] flex gap-4 px-4 py-8">
        {[...IMAGES, ...IMAGES].map((src, i) => (
          <div key={i} className="shrink-0 w-40 h-60 rounded-xl overflow-hidden bg-neutral-800/40">
            <img
              src={src}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes scrollX {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
