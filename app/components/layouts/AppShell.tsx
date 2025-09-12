// components/layouts/AppShell.tsx
import Sidebar from "@/components/navigation/Sidebar";
import BottomTabs from "@/components/navigation/BottomTabs";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white md:block">
        <Sidebar />
      </aside>

      {/* Main content */}
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
