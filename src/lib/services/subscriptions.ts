import { D, dec, type DecLike } from "@/lib/money";

const MONTHLY_FACTOR: Record<string, [number, number]> = {
  WEEKLY: [52, 12],
  MONTHLY: [1, 1],
  QUARTERLY: [1, 3],
  SEMI_ANNUAL: [1, 6],
  YEARLY: [1, 12],
};

export function monthlyCost(amount: DecLike, cycle: string) {
  const [num, den] = MONTHLY_FACTOR[cycle] ?? [1, 1];
  return dec(amount).times(num).div(den).toDecimalPlaces(2, D.ROUND_HALF_UP);
}
export function annualCost(amount: DecLike, cycle: string) {
  const [num, den] = MONTHLY_FACTOR[cycle] ?? [1, 1];
  return dec(amount).times(num).times(12).div(den).toDecimalPlaces(2, D.ROUND_HALF_UP);
}
