import { D, dec, type Dec, type DecLike } from "@/lib/money";
import { addMonths, diffDays } from "@/lib/dates";

export type GoalLike = {
  targetAmount: DecLike;
  targetDate: Date | null;
  status: string;
  contributions: { type: string; amount: DecLike; date: Date }[];
};

export function goalStats(goal: GoalLike, today: Date) {
  let saved: Dec = new D(0);
  for (const c of goal.contributions) saved = c.type === "CONTRIBUTION" ? saved.plus(dec(c.amount)) : saved.minus(dec(c.amount));
  const target = dec(goal.targetAmount);
  const remaining = D.max(target.minus(saved), 0);
  const progress = target.isZero() ? 0 : Math.min(100, saved.div(target).times(100).toDecimalPlaces(1).toNumber());

  // Average net monthly contribution over the last 3 months.
  const since = addMonths(today, -3);
  let recent: Dec = new D(0);
  for (const c of goal.contributions)
    if (c.date >= since) recent = c.type === "CONTRIBUTION" ? recent.plus(dec(c.amount)) : recent.minus(dec(c.amount));
  const avgMonthly = recent.div(3).toDecimalPlaces(2);

  let monthsLeft: number | null = null;
  let requiredMonthly: Dec | null = null;
  let forecast: "complete" | "on_track" | "behind" | "overdue" | "no_deadline" = "no_deadline";
  if (remaining.isZero()) forecast = "complete";
  else if (goal.targetDate) {
    const days = diffDays(goal.targetDate, today);
    monthsLeft = Math.max(0, days / 30.44);
    if (days < 0) forecast = "overdue";
    else {
      requiredMonthly = monthsLeft < 1 ? remaining : remaining.div(monthsLeft).toDecimalPlaces(2, D.ROUND_UP);
      forecast = avgMonthly.gte(requiredMonthly) ? "on_track" : "behind";
    }
  }
  const projectedDate = remaining.gt(0) && avgMonthly.gt(0) ? addMonths(today, Math.ceil(remaining.div(avgMonthly).toNumber())) : null;
  return { saved, target, remaining, progress, avgMonthly, monthsLeft, requiredMonthly, forecast, projectedDate };
}
