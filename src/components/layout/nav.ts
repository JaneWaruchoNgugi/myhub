import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  PiggyBank,
  HandCoins,
  TrendingUp,
  Receipt,
  Repeat,
  Scale,
  CalendarDays,
  ListChecks,
  Bell,
  FolderKanban,
  ListTodo,
  Columns3,
  Bookmark,
  Code2,
  GraduationCap,
  Target,
  NotebookPen,
  FileLock2,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Money",
    items: [
      { href: "/accounts", label: "Accounts", icon: Wallet },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/budgets", label: "Budgets", icon: PieChart },
      { href: "/savings", label: "Savings", icon: PiggyBank },
      { href: "/loans", label: "Loans", icon: HandCoins },
      { href: "/investments", label: "Investments", icon: TrendingUp },
      { href: "/bills", label: "Bills", icon: Receipt },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
      { href: "/net-worth", label: "Net worth", icon: Scale },
    ],
  },
  {
    label: "Planner",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Developer",
    items: [
      { href: "/dev/projects", label: "Projects", icon: FolderKanban },
      { href: "/dev/backlog", label: "Backlog", icon: ListTodo },
      { href: "/dev/kanban", label: "Kanban", icon: Columns3 },
      { href: "/dev/bookmarks", label: "Bookmarks", icon: Bookmark },
      { href: "/dev/snippets", label: "Snippets", icon: Code2 },
      { href: "/dev/learning", label: "Learning", icon: GraduationCap },
      { href: "/dev/goals", label: "Dev goals", icon: Target },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/notes", label: "Notes", icon: NotebookPen },
      { href: "/documents", label: "Document vault", icon: FileLock2 },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Money", icon: ArrowLeftRight },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
];
