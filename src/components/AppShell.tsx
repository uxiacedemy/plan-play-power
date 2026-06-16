import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ShoppingCart, Package, BarChart3, LogOut, Store, Users, LayoutDashboard,
  Truck, UserRound, Settings, Wallet, MoreHorizontal, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { NotificationsBell } from "./NotificationsBell";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: readonly ("owner" | "manager" | "cashier")[] };

const PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ["owner", "manager", "cashier"] },
  { to: "/pos", label: "POS", icon: ShoppingCart, roles: ["owner", "manager", "cashier"] },
  { to: "/products", label: "Products", icon: Package, roles: ["owner", "manager"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "manager"] },
];

const MORE: NavItem[] = [
  { to: "/customers", label: "Customers", icon: UserRound, roles: ["owner", "manager", "cashier"] },
  { to: "/suppliers", label: "Suppliers", icon: Truck, roles: ["owner", "manager"] },
  { to: "/categories", label: "Categories", icon: Tag, roles: ["owner", "manager"] },
  { to: "/expenses", label: "Expenses", icon: Wallet, roles: ["owner", "manager"] },
  { to: "/staff", label: "Staff", icon: Users, roles: ["owner"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["owner"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { role } = useRole();
  const [moreOpen, setMoreOpen] = useState(false);

  const can = (item: NavItem) => (item.roles as readonly string[]).includes(role);
  const primary = PRIMARY.filter(can);
  const more = MORE.filter(can);
  const allDesktop = [...primary, ...more];

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card sticky top-0 h-screen">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg px-4 py-4 border-b border-border">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-4 w-4" />
          </span>
          MboaPOS
        </Link>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {allDesktop.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(n.to) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          <span className="capitalize">{role}</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <Link to="/dashboard" className="md:hidden flex items-center gap-2 font-bold text-lg min-w-0">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Store className="h-4 w-4" />
              </span>
              <span className="truncate">MboaPOS</span>
            </Link>
            <div className="hidden md:block text-sm text-muted-foreground truncate">
              {primary.find((p) => isActive(p.to))?.label ?? more.find((p) => isActive(p.to))?.label ?? ""}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <NotificationsBell />
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-4 pb-24 md:pb-8">{children}</main>

        {/* Mobile bottom nav — 5 items: 4 primary + More */}
        <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {primary.map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    isActive(n.to) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {n.label}
                </Link>
              );
            })}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    more.some((m) => isActive(m.to)) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <MoreHorizontal className="h-5 w-5" />
                  More
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>More</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-3 pt-4">
                  {more.map((n) => {
                    const Icon = n.icon;
                    return (
                      <Link
                        key={n.to}
                        to={n.to}
                        onClick={() => setMoreOpen(false)}
                        className={`flex flex-col items-center gap-2 rounded-xl border border-border p-3 text-xs font-medium ${
                          isActive(n.to) ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {n.label}
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    </div>
  );
}
