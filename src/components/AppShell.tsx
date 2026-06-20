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
  const moreActive = more.some((m) => isActive(m.to));
  const currentLabel =
    primary.find((p) => isActive(p.to))?.label ?? more.find((p) => isActive(p.to))?.label ?? "";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar — Navigation drawer (M3) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card sticky top-0 h-screen">
        <Link to="/dashboard" className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground elevation-1">
            <Store className="h-5 w-5" />
          </span>
          <span className="font-semibold text-lg tracking-tight">MboaPOS</span>
        </Link>
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {allDesktop.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-full h-12 px-4 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : "text-foreground/80 hover:bg-muted"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4 text-xs text-muted-foreground uppercase tracking-wider">
          Role · <span className="text-foreground font-semibold">{role}</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top app bar */}
        <header className="sticky top-0 z-30 bg-card/85 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between gap-2 px-4 h-14">
            <Link to="/dashboard" className="md:hidden flex items-center gap-2 min-w-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <Store className="h-4 w-4" />
              </span>
              <span className="font-semibold text-base truncate">MboaPOS</span>
            </Link>
            <div className="hidden md:block text-base font-semibold text-foreground truncate">
              {currentLabel}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <NotificationsBell />
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                aria-label="Sign out"
                className="h-10 px-3"
              >
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-4 pb-28 md:pb-10">{children}</main>

        {/* Mobile bottom navigation — M3 NavigationBar, 80dp tall */}
        <nav
          className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Primary"
        >
          <div className="grid grid-cols-5 h-20">
            {primary.map((n) => {
              const Icon = n.icon;
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  className="group flex flex-col items-center justify-center gap-1 min-h-12"
                >
                  <span
                    className={`flex items-center justify-center h-8 w-16 rounded-full transition-colors ${
                      active ? "bg-primary-container text-on-primary-container" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`text-[11px] leading-none ${
                      active ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                    }`}
                  >
                    {n.label}
                  </span>
                </Link>
              );
            })}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="More"
                  className="flex flex-col items-center justify-center gap-1 min-h-12"
                >
                  <span
                    className={`flex items-center justify-center h-8 w-16 rounded-full transition-colors ${
                      moreActive ? "bg-primary-container text-on-primary-container" : "text-muted-foreground"
                    }`}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </span>
                  <span
                    className={`text-[11px] leading-none ${
                      moreActive ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                    }`}
                  >
                    More
                  </span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl border-t border-border">
                <SheetHeader>
                  <SheetTitle className="text-left">More</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-3 pt-4 pb-2">
                  {more.map((n) => {
                    const Icon = n.icon;
                    const active = isActive(n.to);
                    return (
                      <Link
                        key={n.to}
                        to={n.to}
                        onClick={() => setMoreOpen(false)}
                        className={`flex flex-col items-center justify-center gap-2 rounded-2xl min-h-[88px] p-3 text-xs font-medium transition-colors ${
                          active
                            ? "bg-primary-container text-on-primary-container"
                            : "bg-surface-2 text-foreground hover:bg-surface-3"
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
