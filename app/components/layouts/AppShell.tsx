// app/components/layouts/AppShell.tsx
import Sidebar from "../navigation/Sidebar";
import BottomTabs from "../navigation/BottomTabs";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-neutral-950 text-neutral-100">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1">{children}</main>

        {/* Mobile bottom tabs */}
        <div className="md:hidden">
          <BottomTabs />
        </div>
      </div>
    </div>
  );
}
