import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Package, BarChart3, LogOut, Store } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/pos", label: "POS", icon: ShoppingCart },
  { to: "/products", label: "Products", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/pos" className="flex items-center gap-2 font-bold text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </span>
            <span>MboaPOS</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-3">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="hidden md:flex fixed left-1/2 -translate-x-1/2 bottom-6 z-30 gap-1 rounded-full border border-border bg-card/95 px-2 py-2 shadow-lg backdrop-blur">
        {nav.map((n) => {
          const active = pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
