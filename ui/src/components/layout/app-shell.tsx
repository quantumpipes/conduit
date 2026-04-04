import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";

export function AppShell({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts();

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <StatusBar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
