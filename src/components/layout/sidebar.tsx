"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

export function SidebarNav({ onNavigate, unread }: { onNavigate?: () => void; unread?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5 px-3 pb-6" aria-label="Main">
      {NAV.map((group) => (
        <div key={group.label}>
          <div className="text-sidebar-muted mb-1.5 px-3 text-[11px] font-semibold tracking-wider uppercase">{group.label}</div>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-indigo-300" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.href === "/notifications" && unread ? (
                      <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ unread }: { unread: number }) {
  return (
    <aside className="bg-sidebar border-sidebar-border fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex">
      <div className="flex h-16 items-center px-6">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
        <SidebarNav unread={unread} />
      </div>
    </aside>
  );
}
