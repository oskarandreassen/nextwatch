// app/components/layouts/AppShell.tsx
import Sidebar from "../navigation/Sidebar";
import BottomTabs from "../navigation/BottomTabs";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-neutral-950 text-neutral-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-neutral-800 bg-neutral-900/60 backdrop-blur md:block">
        <Sidebar />
      </aside>

      {/* Main */}
      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="flex-1">{children}</main>
        {/* Mobile tabs */}
        <nav className="md:hidden">
          <BottomTabs />
        </nav>
      </div>
    </div>
  );
}
