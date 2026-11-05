import { D, dec, type Dec, type DecLike } from "@/lib/money";
import { advance, periodsPerYear, type Freq } from "@/lib/dates";

export type ScheduleRow = { n: number; date: Date; payment: Dec; interest: Dec; principal: Dec; balance: Dec };

/** Number of repayment periods between start and due date for a frequency (min 1). */
export function periodCount(start: Date, due: Date, freq: Freq): number {
  let n = 0;
  let d = start;
  const anchor = start.getUTCDate();
  while (n < 1200) {
    d = advance(d, freq, anchor);
    n++;
    if (d >= due) break;
  }
  return Math.max(1, n);
}

/**
 * Reducing-balance amortization schedule. Annual rate is a percentage.
 * The last payment absorbs rounding so the balance ends at exactly zero.
 */
export function amortize(principal: DecLike, annualRatePct: DecLike, start: Date, due: Date, freq: Freq): ScheduleRow[] {
  const P = dec(principal);
  const n = periodCount(start, due, freq);
  const r = dec(annualRatePct).div(100).div(periodsPerYear(freq));
  const payment = r.isZero() ? P.div(n) : P.times(r).div(new D(1).minus(new D(1).plus(r).pow(-n)));
  const pay = payment.toDecimalPlaces(2, D.ROUND_HALF_UP);
  const rows: ScheduleRow[] = [];
  let bal = P;
  let d = start;
  const anchor = start.getUTCDate();
  for (let i = 1; i <= n; i++) {
    d = advance(d, freq, anchor);
    const interest = bal.times(r).toDecimalPlaces(2, D.ROUND_HALF_UP);
    let principalPart = pay.minus(interest);
    if (i === n || principalPart.gt(bal)) principalPart = bal;
    const rowPayment = principalPart.plus(interest);
    bal = bal.minus(principalPart);
    rows.push({ n: i, date: i === n ? due : d, payment: rowPayment, interest, principal: principalPart, balance: bal });
  }
  return rows;
}

export type LoanLike = {
  principal: DecLike;
  interestRate: DecLike;
  startDate: Date;
  dueDate: Date;
  frequency: Freq;
  status: string;
  repayments: { principalAmount: DecLike; interestAmount: DecLike; date: Date }[];
};

export function loanSummary(loan: LoanLike, today: Date) {
  const principal = dec(loan.principal);
  const principalRepaid = loan.repayments.reduce<Dec>((a, r) => a.plus(dec(r.principalAmount)), new D(0));
  const interestPaid = loan.repayments.reduce<Dec>((a, r) => a.plus(dec(r.interestAmount)), new D(0));
  const outstanding = D.max(principal.minus(principalRepaid), 0);
  const schedule = amortize(principal, loan.interestRate, loan.startDate, loan.dueDate, loan.frequency);
  const scheduledInterest = schedule.reduce<Dec>((a, r) => a.plus(r.interest), new D(0));
  const progress = principal.isZero() ? 100 : principalRepaid.div(principal).times(100).toDecimalPlaces(1).toNumber();

  // Next instalment: first scheduled row not yet covered by principal repaid.
  let cumulative = new D(0);
  let next: ScheduleRow | null = null;
  for (const row of schedule) {
    cumulative = cumulative.plus(row.principal);
    if (cumulative.gt(principalRepaid)) {
      next = row;
      break;
    }
  }
  const active = loan.status === "ACTIVE" && outstanding.gt(0);
  const isOverdue = active && ((next && next.date < today) || loan.dueDate < today);
  const periodRate = dec(loan.interestRate).div(100).div(periodsPerYear(loan.frequency));
  const suggestedInterest = outstanding.times(periodRate).toDecimalPlaces(2, D.ROUND_HALF_UP);
  const suggestedPrincipal = next ? D.min(D.max(next.payment.minus(suggestedInterest), 0), outstanding) : outstanding;
  return {
    principal,
    principalRepaid,
    interestPaid,
    outstanding,
    scheduledInterest,
    progress: Math.min(100, progress),
    schedule,
    next: active ? next : null,
    isOverdue: !!isOverdue,
    suggestedInterest,
    suggestedPrincipal: suggestedPrincipal.toDecimalPlaces(2, D.ROUND_HALF_UP),
  };
}
