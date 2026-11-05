import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFinanceOptions } from "@/lib/services/options";
import { startOfYear, todayIn } from "@/lib/dates";
import { sum } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { loanRow } from "./data";
import { LoansView } from "./view";

export const metadata: Metadata = { title: "Loans" };

export default async function LoansPage() {
  const user = await requireUserPage();
  const today = todayIn(user.prefs.timezone);
  const [loans, options] = await Promise.all([
    prisma.loan.findMany({ where: { userId: user.id }, include: { repayments: true, account: { select: { name: true } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] }),
    getFinanceOptions(user.id),
  ]);
  const rows = loans.map((l) => loanRow(l, today));
  const ytd = startOfYear(today);
  const interestYtd = sum(loans.filter((l) => l.direction === "BORROWED").flatMap((l) => l.repayments.filter((r) => r.date >= ytd).map((r) => r.interestAmount)));
  const borrowed = rows.filter((r) => r.direction === "BORROWED" && r.status !== "WRITTEN_OFF");
  const principal = sum(borrowed.map((r) => r.principal));
  const repaid = sum(borrowed.map((r) => r.principalRepaid));
  return (
    <div>
      <PageHeader title="Loans & debt" description="Money you've borrowed and money you've lent. Principal and interest are tracked separately." />
      <LoansView
        rows={rows}
        options={options}
        summary={{
          owed: sum(borrowed.filter((r) => r.status === "ACTIVE").map((r) => r.outstanding)).toString(),
          owedToYou: sum(rows.filter((r) => r.direction === "LENT" && r.status === "ACTIVE").map((r) => r.outstanding)).toString(),
          interestYtd: interestYtd.toString(),
          debtProgress: principal.isZero() ? 0 : repaid.div(principal).times(100).toDecimalPlaces(1).toNumber(),
          overdue: rows.filter((r) => r.isOverdue).length,
        }}
      />
    </div>
  );
}
