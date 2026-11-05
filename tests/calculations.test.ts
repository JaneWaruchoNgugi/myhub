import { vi } from "vitest";
vi.mock("@/lib/session", () => ({ AuthError: class AuthError extends Error {} }));
import { describe, expect, it } from "vitest";
import { D, sum } from "@/lib/money";
import { addMonths, advance, dayFromString, dayString, diffDays, endOfMonth, zonedToInstant, instantToZoned } from "@/lib/dates";
import { amortize, loanSummary, periodCount } from "@/lib/services/loans";
import { goalStats } from "@/lib/services/savings";
import { annualCost, monthlyCost } from "@/lib/services/subscriptions";
import { holdingStats } from "@/lib/services/investments";
import { csvCell, toCsv } from "@/lib/csv";

const d = dayFromString;

describe("money", () => {
  it("sums decimals without float drift", () => {
    expect(sum(["0.10", "0.20", "0.30"]).toString()).toBe("0.6");
    expect(sum([]).toString()).toBe("0");
  });
});

describe("dates", () => {
  it("clamps month ends and keeps the anchor day", () => {
    expect(dayString(addMonths(d("2026-01-31"), 1))).toBe("2026-02-28");
    expect(dayString(addMonths(d("2026-02-28"), 1, 31))).toBe("2026-03-31");
    expect(dayString(advance(d("2024-02-29"), "YEARLY"))).toBe("2025-02-28");
  });
  it("computes month end and day differences", () => {
    expect(dayString(endOfMonth(d("2026-02-10")))).toBe("2026-02-28");
    expect(diffDays(d("2026-03-01"), d("2026-02-01"))).toBe(28);
  });
  it("round-trips wall-clock times in Nairobi (UTC+3)", () => {
    const i = zonedToInstant("2026-05-01T09:00:00", "Africa/Nairobi");
    expect(i.toISOString()).toBe("2026-05-01T06:00:00.000Z");
    expect(instantToZoned(i, "Africa/Nairobi")).toBe("2026-05-01T09:00");
  });
});

describe("loans", () => {
  const start = d("2026-01-01");
  const due = d("2027-01-01");

  it("counts periods", () => {
    expect(periodCount(start, due, "MONTHLY")).toBe(12);
  });

  it("amortizes so principal sums exactly to the loan and balance ends at zero", () => {
    const s = amortize("120000", "14", start, due, "MONTHLY");
    expect(s).toHaveLength(12);
    expect(sum(s.map((r) => r.principal)).toString()).toBe("120000");
    expect(s.at(-1)!.balance.toString()).toBe("0");
    // Reducing balance: interest falls every period.
    expect(s[0].interest.gt(s[11].interest)).toBe(true);
    // First period interest = 120000 * 14% / 12
    expect(s[0].interest.toString()).toBe("1400");
  });

  it("zero-interest loans split evenly", () => {
    const s = amortize("1200", "0", start, due, "MONTHLY");
    expect(s.every((r) => r.interest.isZero())).toBe(true);
    expect(sum(s.map((r) => r.payment)).toString()).toBe("1200");
  });

  it("only principal reduces the outstanding balance, never interest", () => {
    const loan = { principal: "100000", interestRate: "12", startDate: start, dueDate: due, frequency: "MONTHLY" as const, status: "ACTIVE", repayments: [{ principalAmount: "8000", interestAmount: "1000", date: d("2026-02-01") }, { principalAmount: "8000", interestAmount: "920", date: d("2026-03-01") }] };
    const s = loanSummary(loan, d("2026-03-15"));
    expect(s.outstanding.toString()).toBe("84000");
    expect(s.interestPaid.toString()).toBe("1920");
    expect(s.principalRepaid.toString()).toBe("16000");
  });

  it("never reports negative outstanding after overpayment", () => {
    const loan = { principal: "1000", interestRate: "0", startDate: start, dueDate: due, frequency: "MONTHLY" as const, status: "ACTIVE", repayments: [{ principalAmount: "1500", interestAmount: "0", date: d("2026-02-01") }] };
    expect(loanSummary(loan, start).outstanding.toString()).toBe("0");
  });
});

describe("savings goals", () => {
  it("nets withdrawals against contributions and caps progress", () => {
    const g = { targetAmount: "10000", targetDate: null, status: "ACTIVE", contributions: [{ type: "CONTRIBUTION", amount: "6000", date: d("2026-01-10") }, { type: "WITHDRAWAL", amount: "1000", date: d("2026-02-10") }] };
    const s = goalStats(g, d("2026-03-01"));
    expect(s.saved.toString()).toBe("5000");
    expect(s.remaining.toString()).toBe("5000");
    expect(s.progress).toBe(50);
  });
  it("marks complete and over-target goals as 100%", () => {
    const g = { targetAmount: "1000", targetDate: d("2026-12-01"), status: "ACTIVE", contributions: [{ type: "CONTRIBUTION", amount: "1200", date: d("2026-01-01") }] };
    const s = goalStats(g, d("2026-02-01"));
    expect(s.progress).toBe(100);
    expect(s.forecast).toBe("complete");
  });
});

describe("subscriptions", () => {
  it("normalises billing cycles", () => {
    expect(monthlyCost("1200", "YEARLY").toString()).toBe("100");
    expect(annualCost("100", "WEEKLY").toString()).toBe("5200");
    expect(annualCost("1100", "MONTHLY").toString()).toBe("13200");
    expect(monthlyCost("300", "QUARTERLY").toString()).toBe("100");
  });
});

describe("investments", () => {
  it("separates unrealized, realized and income returns", () => {
    const s = holdingStats({ units: "100", costBasis: "2000", currentPrice: "25", transactions: [{ type: "SELL", amount: "500", realizedGain: "100" }, { type: "DIVIDEND", amount: "80", realizedGain: null }] });
    expect(s.value.toString()).toBe("2500");
    expect(s.unrealized.toString()).toBe("500");
    expect(s.unrealizedPct).toBe(25);
    expect(s.realized.toString()).toBe("100");
    expect(s.income.toString()).toBe("80");
    expect(s.totalReturn.toString()).toBe("680");
  });
});

describe("csv", () => {
  it("escapes quotes, commas and blocks formula injection", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1500.50")).toBe("-1500.50");
    expect(toCsv(["a"], [[new D("1.5")]])).toContain("1.5");
  });
});
