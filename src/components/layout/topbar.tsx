"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, LogOut, Menu, Moon, Settings, Sun, Monitor, User } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarNav } from "./sidebar";
import { Logo } from "./logo";
import { CommandMenu } from "./command-menu";
import { NAV, MOBILE_TABS } from "./nav";
import { initials, cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";

function pageTitle(pathname: string) {
  for (const g of NAV) for (const i of g.items) if (pathname === i.href || pathname.startsWith(`${i.href}/`)) return i.label;
  return "MYHUB";
}

export function Topbar({ user, unread, isDemo }: { user: { name: string | null; email: string }; unread: number; isDemo: boolean }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();

  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur-md">
      {isDemo ? <div className="bg-amber-500/15 px-4 py-1 text-center text-xs font-medium text-amber-800 dark:text-amber-300">Demo account: sample data only, kept separate from your real records.</div> : null}
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:h-16">
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
              <Menu />
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />
            <DialogPrimitive.Content className="bg-sidebar data-[state=open]:animate-in data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col lg:hidden">
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">Main navigation</DialogPrimitive.Description>
              <div className="flex h-16 items-center px-5">
                <Logo />
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav onNavigate={() => setOpen(false)} unread={unread} />
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="truncate text-sm font-semibold md:hidden">{pageTitle(pathname)}</span>
          <CommandMenu />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme">
              <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {[
              { v: "light", l: "Light", i: <Sun /> },
              { v: "dark", l: "Dark", i: <Moon /> },
              { v: "system", l: "System", i: <Monitor /> },
            ].map((t) => (
              <DropdownMenuItem key={t.v} onSelect={() => setTheme(t.v)} className={cn(theme === t.v && "font-semibold")}>
                {t.i} {t.l}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" asChild className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Link href="/notifications">
            <Bell />
            {unread ? <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-background" /> : null}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu">
              <span className="bg-primary/15 text-primary flex size-7 items-center justify-center rounded-full text-xs font-semibold">{initials(user.name ?? user.email)}</span>
              <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{user.name ?? user.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <User /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings?tab=preferences">
                <Settings /> Preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOutAction()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function MobileTabs() {
  const pathname = usePathname();
  return (
    <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Quick navigation">
      <ul className="grid grid-cols-4">
        {MOBILE_TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} className={cn("flex flex-col items-center gap-1 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="size-5" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
