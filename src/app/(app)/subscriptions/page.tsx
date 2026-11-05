import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFinanceOptions } from "@/lib/services/options";
import { annualCost, monthlyCost } from "@/lib/services/subscriptions";
import { diffDays, todayIn } from "@/lib/dates";
import { sum } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { SubscriptionsView } from "./view";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage() {
  const user = await requireUserPage();
  const today = todayIn(user.prefs.timezone);
  const [subs, options] = await Promise.all([
    prisma.subscription.findMany({ where: { userId: user.id }, include: { category: { select: { name: true } }, charges: { orderBy: { billingDate: "desc" }, take: 24 } }, orderBy: [{ status: "asc" }, { nextBillingDate: "asc" }] }),
    getFinanceOptions(user.id),
  ]);
  const active = subs.filter((s) => s.status === "ACTIVE" || s.status === "TRIAL");
  return (
    <div>
      <PageHeader title="Subscriptions" description="Streaming, software, hosting and memberships, normalised to monthly and annual cost." />
      <SubscriptionsView
        options={options}
        totals={{ monthly: sum(active.map((s) => monthlyCost(s.amount, s.billingCycle))).toString(), annual: sum(active.map((s) => annualCost(s.amount, s.billingCycle))).toString(), count: active.length }}
        rows={subs.map((s) => ({
          id: s.id,
          name: s.name,
          provider: s.provider ?? "",
          amount: s.amount.toString(),
          billingCycle: s.billingCycle,
          nextBillingDate: s.nextBillingDate.toISOString().slice(0, 10),
          daysUntil: diffDays(s.nextBillingDate, today),
          paymentMethod: s.paymentMethod ?? "",
          status: s.status,
          categoryId: s.categoryId ?? "",
          categoryName: s.category?.name ?? null,
          accountId: s.accountId ?? "",
          url: s.url ?? "",
          notes: s.notes ?? "",
          monthly: monthlyCost(s.amount, s.billingCycle).toString(),
          annual: annualCost(s.amount, s.billingCycle).toString(),
          charges: s.charges.map((c) => ({ id: c.id, date: c.billingDate.toISOString().slice(0, 10), amount: c.amount.toString() })),
        }))}
      />
    </div>
  );
}
