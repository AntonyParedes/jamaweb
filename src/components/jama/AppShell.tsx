import { Link } from "@tanstack/react-router";
import { House, Search, Heart, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/jama-logo.webp.asset.json";

const NAV = [
  { to: "/", label: "Inicio", icon: House },
  { to: "/explorar", label: "Explorar", icon: Search },
  { to: "/favoritos", label: "Favoritos", icon: Heart },
  { to: "/cuenta", label: "Mi cuenta", icon: UserRound },
] as const;

export function Logo({ className = "h-10" }: { className?: string }) {
  return (
    <img src={logo.url} alt="JAMA" className={`${className} w-auto object-contain scale-150`} />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16">
          <Link to="/" className="flex items-center overflow-hidden px-2" aria-label="Inicio JAMA">
            <Logo className="h-10 md:h-12" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "!bg-lime !text-lime-foreground" }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="pb-safe-nav md:pb-12">{children}</main>

      <nav
        aria-label="Navegación principal"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: true }}
                className="press group flex min-h-14 flex-col items-center justify-center gap-0.5 pt-2 text-[11px] font-bold text-muted-foreground"
                activeProps={{ className: "!text-foreground", "aria-current": "page" }}
              >
                <span className="grid h-8 w-14 place-items-center rounded-full transition-colors group-aria-[current=page]:bg-lime">
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
