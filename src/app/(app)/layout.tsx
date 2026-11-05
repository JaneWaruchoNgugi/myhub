import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { runMaintenance } from "@/lib/services/maintenance";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar, MobileTabs } from "@/components/layout/topbar";
import { PrefsProvider } from "@/components/providers";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  await runMaintenance(user.id, user.prefs);
  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false, dismissed: false } });
  const { currency, locale, timezone, weekStartsOn } = user.prefs;
  return (
    <PrefsProvider value={{ currency, locale, timezone, weekStartsOn }}>
      <Sidebar unread={unread} />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <Topbar user={{ name: user.name, email: user.email }} unread={unread} isDemo={user.isDemo} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <MobileTabs />
    </PrefsProvider>
  );
}
