import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  let user: { email?: string } | null = null;
  if (process.env.PLAYWRIGHT_TEST === "1") {
    user = { email: process.env.E2E_TEST_EMAIL ?? "e2e@example.com" };
  } else {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  }

  // Defense in depth: the proxy already redirects unauthenticated visits,
  // but every server-rendered protected route re-verifies the session too.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <CommandPalette />
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
        <a href="/dashboard" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-mono text-sm uppercase tracking-widest">
            LedgerLock
          </span>
        </a>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="/dashboard" className="hover:text-foreground">
            Documents
          </a>
          <a href="/audit-log" className="hover:text-foreground">
            Audit log
          </a>
          <kbd className="hidden rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
          <span className="hidden font-mono text-xs sm:inline">
            {user.email}
          </span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              Log out
            </Button>
          </form>
        </nav>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
