import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginCard from './components/auth/LoginCard';
import HeroReel from './components/landing/HeroReel';

export default async function HomePage() {
  const jar = cookies();
  const uid = jar.get('nw_uid')?.value ?? null;
  const last = jar.get('nw_last')?.value ?? null;

  const within5min =
    last ? Date.now() - Number.parseInt(last, 10) < 5 * 60 * 1000 : false;

  if (uid && within5min) {
    redirect('/swipe');
  }

  return (
    <div className="relative min-h-dvh">
      <HeroReel />
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Hitta nästa film/serie – snabbt
        </h1>
        <p className="mt-4 text-neutral-300">
          Tinder-känsla för film & serier. Bygg smakprofil, swipa solo eller i grupp.
        </p>
        <div className="mt-8">
          <LoginCard />
        </div>
        <div className="mt-6 text-sm text-neutral-400">
          Ny användare? <a className="underline" href="/onboarding">Starta onboarding</a>
        </div>
      </div>
    </div>
  );
}
