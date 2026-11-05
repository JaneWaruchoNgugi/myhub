"use client";
import { EntityForm, type FieldDef } from "@/components/shared/entity-form";
import { usePrefs } from "@/components/providers";
import { todayStr } from "@/lib/today";
import { billPaySchema, billSchema, investmentCreateSchema, investmentSchema, investmentTxnSchema, loanSchema, priceUpdateSchema, repaymentSchema, subscriptionChargeSchema, subscriptionSchema, watchlistSchema } from "@/lib/validation/obligations";
import { addRepayment, createLoan, updateLoan } from "@/server/actions/loans";
import { addInvestmentTxn, createInvestment, saveWatchlistItem, updateInvestment, updatePrice } from "@/server/actions/investments";
import { payBill, recordSubscriptionCharge, saveBill, saveSubscription } from "@/server/actions/bills";
import { ASSET_CLASS_OPTS, BILL_KIND_OPTS, CYCLE_OPTS, FREQ_OPTS, LOAN_STATUS_OPTS, LOAN_TYPE_OPTS, RECURRENCE_OPTS, SUB_STATUS_OPTS, type FinanceOptions } from "./options";

type Base = { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void };
type Init = Record<string, unknown> & { id?: string };

export function LoanDialog({ options, initial, ...p }: Base & { options: FinanceOptions; initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id;
  return (
    <EntityForm
      {...p}
      wide
      title={id ? "Edit loan" : "Add loan"}
      description="Principal and interest are tracked separately. Receiving or lending principal is a cash movement, not income or expense."
      schema={loanSchema}
      fields={[
        { name: "direction", label: "Direction", type: "select", options: [{ value: "BORROWED", label: "I borrowed money" }, { value: "LENT", label: "I lent money" }] },
        { name: "loanType", label: "Loan type", type: "select", options: LOAN_TYPE_OPTS },
        { name: "name", label: "Loan name", type: "text", placeholder: "e.g. KCB personal loan" },
        { name: "counterparty", label: "Lender / borrower", type: "text", placeholder: "Who you owe, or who owes you" },
        { name: "principal", label: "Principal amount", type: "money" },
        { name: "interestRate", label: "Annual interest rate (%)", type: "text", placeholder: "e.g. 13", description: "Reducing balance. Use 0 for interest-free." },
        { name: "startDate", label: "Start date", type: "date" },
        { name: "dueDate", label: "Final due date", type: "date" },
        { name: "frequency", label: "Repayment frequency", type: "select", options: FREQ_OPTS },
        { name: "status", label: "Status", type: "select", options: LOAN_STATUS_OPTS },
        {
          name: "accountId",
          label: "Principal moved through account",
          type: "select",
          allowNone: "Don't record a cash movement",
          options: options.accounts,
          span: 2,
          description: "Borrowed: where the money landed. Lent: where it came from. Leave empty for loans that predate your MYHUB records.",
        },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ direction: "BORROWED", loanType: "PERSONAL", name: "", counterparty: "", principal: "", interestRate: "0", startDate: todayStr(prefs.timezone), dueDate: "", frequency: "MONTHLY", status: "ACTIVE", accountId: "", notes: "", ...initial }}
      onSubmit={(v) => (id ? updateLoan(id, v) : createLoan(v))}
    />
  );
}

export function RepaymentDialog({ options, loanId, direction, suggested, ...p }: Base & { options: FinanceOptions; loanId: string; direction: "BORROWED" | "LENT"; suggested?: { principal: string; interest: string; accountId?: string } }) {
  const prefs = usePrefs();
  return (
    <EntityForm
      {...p}
      title={direction === "BORROWED" ? "Record repayment" : "Record money received"}
      description="Principal reduces the balance. Interest is recorded as an expense (borrowed) or income (lent)."
      schema={repaymentSchema}
      fields={[
        { name: "principalAmount", label: "Principal", type: "money" },
        { name: "interestAmount", label: "Interest", type: "money" },
        { name: "date", label: "Date", type: "date" },
        { name: "accountId", label: direction === "BORROWED" ? "Paid from" : "Received into", type: "select", allowNone: "Don't record a cash movement", options: options.accounts },
        { name: "note", label: "Note", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ loanId, principalAmount: suggested?.principal ?? "", interestAmount: suggested?.interest ?? "0", date: todayStr(prefs.timezone), accountId: suggested?.accountId ?? "", note: "" }}
      onSubmit={(v) => addRepayment(v)}
    />
  );
}

export function InvestmentDialog({ options, initial, ...p }: Base & { options: FinanceOptions; initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id;
  const common: FieldDef[] = [
    { name: "name", label: "Investment name", type: "text", placeholder: "e.g. Safaricom PLC, CIC Money Market" },
    { name: "symbol", label: "Symbol / code", type: "text", placeholder: "Optional, e.g. SCOM" },
    { name: "assetClass", label: "Asset class", type: "select", options: ASSET_CLASS_OPTS },
    { name: "platform", label: "Broker / platform", type: "text", placeholder: "e.g. Ziidi, Hisa, CDS" },
    { name: "accountId", label: "Default cash account", type: "select", allowNone: "None", options: options.accounts, span: 2, description: "Used by default when recording buys, sales and dividends." },
  ];
  if (id)
    return (
      <EntityForm
        {...p}
        title="Edit investment"
        schema={investmentSchema}
        fields={[...common, { name: "notes", label: "Notes", type: "textarea", rows: 2 }]}
        defaultValues={{ name: "", symbol: "", assetClass: "STOCK", platform: "", accountId: "", notes: "", ...initial }}
        onSubmit={(v) => updateInvestment(id, v)}
      />
    );
  return (
    <EntityForm
      {...p}
      wide
      title="Add investment"
      description="Prices are entered manually. MYHUB never invents market prices."
      schema={investmentCreateSchema}
      fields={[
        ...common,
        { name: "initialUnits", label: "Units bought", type: "units", placeholder: "Optional opening position" },
        { name: "initialPrice", label: "Price per unit", type: "units" },
        { name: "initialFees", label: "Fees", type: "money", placeholder: "0" },
        { name: "purchaseDate", label: "Purchase date", type: "date" },
        { name: "payFromAccount", label: "Pay from the default cash account", type: "switch", description: "Off: records the holding without moving cash (e.g. you bought it before using MYHUB)." },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ name: "", symbol: "", assetClass: "STOCK", platform: "", accountId: "", initialUnits: "", initialPrice: "", initialFees: "", purchaseDate: todayStr(prefs.timezone), payFromAccount: false, notes: "" }}
      onSubmit={(v) => createInvestment(v)}
    />
  );
}

export function InvestmentTxnDialog({ options, investmentId, accountId, type, ...p }: Base & { options: FinanceOptions; investmentId: string; accountId?: string | null; type: "BUY" | "SELL" | "DIVIDEND" | "INTEREST" }) {
  const prefs = usePrefs();
  const trade = type === "BUY" || type === "SELL";
  const title = { BUY: "Record purchase", SELL: "Record sale", DIVIDEND: "Record dividend", INTEREST: "Record interest" }[type];
  return (
    <EntityForm
      {...p}
      title={title}
      description={
        type === "BUY" ? "Cash leaves the account as an outflow (not an expense)." : type === "SELL" ? "Realized gain is calculated with average cost." : "Recorded as investment income in the chosen account."
      }
      schema={investmentTxnSchema}
      fields={[
        ...(trade
          ? ([
              { name: "units", label: "Units", type: "units" },
              { name: "price", label: "Price per unit", type: "units" },
              { name: "fees", label: "Fees / charges", type: "money" },
            ] as FieldDef[])
          : ([{ name: "amount", label: "Amount received", type: "money" }] as FieldDef[])),
        { name: "date", label: "Date", type: "date" },
        { name: "accountId", label: type === "BUY" ? "Paid from" : "Received into", type: "select", allowNone: trade ? "Don't move cash" : "Not paid out (reinvested)", options: options.accounts, span: 2 },
        { name: "note", label: "Note", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ investmentId, type, units: "", price: "", amount: "", fees: "0", date: todayStr(prefs.timezone), accountId: accountId ?? "", note: "" }}
      onSubmit={(v) => addInvestmentTxn({ ...v, type })}
    />
  );
}

export function PriceDialog({ investmentId, currentPrice, ...p }: Base & { investmentId: string; currentPrice?: string }) {
  const prefs = usePrefs();
  return (
    <EntityForm
      {...p}
      title="Update market price"
      description="Enter the latest price per unit, or the total current value of the holding (useful for money market funds and T-bills)."
      schema={priceUpdateSchema}
      fields={[
        { name: "mode", label: "I'm entering", type: "select", options: [{ value: "PRICE", label: "Price per unit" }, { value: "VALUE", label: "Total current value" }], span: 2 },
        { name: "value", label: "Value", type: "units" },
        { name: "date", label: "As of", type: "date" },
      ]}
      defaultValues={{ investmentId, mode: "PRICE", value: currentPrice ?? "", date: todayStr(prefs.timezone) }}
      onSubmit={(v) => updatePrice(v)}
    />
  );
}

export function WatchlistDialog({ initial, ...p }: Base & { initial?: Init }) {
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit watchlist item" : "Add to watchlist"}
      schema={watchlistSchema}
      fields={[
        { name: "symbol", label: "Symbol", type: "text" },
        { name: "name", label: "Name", type: "text" },
        { name: "assetClass", label: "Asset class", type: "select", options: ASSET_CLASS_OPTS, span: 2 },
        { name: "lastPrice", label: "Last price you saw", type: "units" },
        { name: "targetPrice", label: "Target buy price", type: "units" },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ symbol: "", name: "", assetClass: "STOCK", lastPrice: "", targetPrice: "", notes: "", ...initial }}
      onSubmit={(v) => saveWatchlistItem(id, v)}
    />
  );
}

export function BillDialog({ options, initial, ...p }: Base & { options: FinanceOptions; initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      wide
      title={id ? "Edit bill" : "Add bill"}
      schema={billSchema}
      fields={[
        { name: "name", label: "Bill name", type: "text", placeholder: "e.g. KPLC tokens, Rent" },
        { name: "kind", label: "Kind", type: "select", options: BILL_KIND_OPTS },
        { name: "amount", label: "Amount", type: "money" },
        { name: "nextDueDate", label: "Next due date", type: "date" },
        { name: "recurrence", label: "Repeats", type: "select", options: RECURRENCE_OPTS },
        { name: "categoryId", label: "Expense category", type: "select", allowNone: "Uncategorised", options: options.expenseCategories, hidden: (v) => v.kind === "LOAN_REPAYMENT" },
        { name: "loanId", label: "Loan being repaid", type: "select", options: options.loans, hidden: (v) => v.kind !== "LOAN_REPAYMENT", description: "Payments are split into principal and interest on the loan." },
        { name: "accountId", label: "Usually paid from", type: "select", allowNone: "Choose when paying", options: options.accounts },
        { name: "paymentMethod", label: "Payment method", type: "text", placeholder: "e.g. M-Pesa Paybill 888880" },
        { name: "isActive", label: "Active", type: "switch" },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ name: "", kind: "OTHER", amount: "", nextDueDate: todayStr(prefs.timezone), recurrence: "MONTHLY", categoryId: "", loanId: "", accountId: "", paymentMethod: "", isActive: true, notes: "", ...initial }}
      onSubmit={(v) => saveBill(id, v)}
    />
  );
}

export function PayBillDialog({ options, bill, candidates, ...p }: Base & { options: FinanceOptions; bill: { id: string; name: string; amount: string; accountId: string | null; paymentMethod: string | null; isLoan: boolean }; candidates: { value: string; label: string }[] }) {
  const prefs = usePrefs();
  return (
    <EntityForm
      {...p}
      title={`Pay ${bill.name}`}
      description={bill.isLoan ? "This pays the linked loan: interest first, the rest reduces principal." : "Creates one expense for this billing period. Already recorded it? Link that expense instead."}
      schema={billPaySchema}
      fields={[
        { name: "amount", label: "Amount paid", type: "money" },
        { name: "paidDate", label: "Paid on", type: "date" },
        { name: "accountId", label: "Paid from", type: "select", options: options.accounts, hidden: (v) => !!v.linkTransactionId },
        { name: "paymentMethod", label: "Payment method", type: "text" },
        ...(bill.isLoan || !candidates.length
          ? []
          : ([{ name: "linkTransactionId", label: "Link an existing expense", type: "select", allowNone: "No, create a new expense", options: candidates, span: 2 }] as FieldDef[])),
        { name: "note", label: "Note", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ billId: bill.id, amount: bill.amount, paidDate: todayStr(prefs.timezone), accountId: bill.accountId ?? options.accounts[0]?.value ?? "", paymentMethod: bill.paymentMethod ?? "", linkTransactionId: "", note: "" }}
      onSubmit={(v) => payBill(v)}
      submitLabel="Mark as paid"
    />
  );
}

export function SubscriptionDialog({ options, initial, ...p }: Base & { options: FinanceOptions; initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      wide
      title={id ? "Edit subscription" : "Add subscription"}
      schema={subscriptionSchema}
      fields={[
        { name: "name", label: "Name", type: "text", placeholder: "e.g. Netflix, Vercel Pro" },
        { name: "provider", label: "Provider", type: "text" },
        { name: "amount", label: "Amount per cycle", type: "money" },
        { name: "billingCycle", label: "Billing cycle", type: "select", options: CYCLE_OPTS },
        { name: "nextBillingDate", label: "Next billing date", type: "date" },
        { name: "status", label: "Status", type: "select", options: SUB_STATUS_OPTS },
        { name: "categoryId", label: "Expense category", type: "select", allowNone: "Uncategorised", options: options.expenseCategories },
        { name: "accountId", label: "Charged to", type: "select", allowNone: "Choose when charged", options: options.accounts },
        { name: "paymentMethod", label: "Payment method", type: "text", placeholder: "e.g. Visa •• 4242" },
        { name: "url", label: "Manage URL", type: "url", placeholder: "https://" },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ name: "", provider: "", amount: "", billingCycle: "MONTHLY", nextBillingDate: todayStr(prefs.timezone), status: "ACTIVE", categoryId: "", accountId: "", paymentMethod: "", url: "", notes: "", ...initial }}
      onSubmit={(v) => saveSubscription(id, v)}
    />
  );
}

export function ChargeDialog({ options, sub, ...p }: Base & { options: FinanceOptions; sub: { id: string; name: string; amount: string; accountId: string | null; nextBillingDate: string } }) {
  return (
    <EntityForm
      {...p}
      title={`Record ${sub.name} charge`}
      description="Adds the charge as an expense and moves the next billing date forward."
      schema={subscriptionChargeSchema}
      fields={[
        { name: "amount", label: "Amount charged", type: "money" },
        { name: "date", label: "Charged on", type: "date" },
        { name: "accountId", label: "Charged to", type: "select", options: options.accounts, span: 2 },
      ]}
      defaultValues={{ subscriptionId: sub.id, amount: sub.amount, date: sub.nextBillingDate, accountId: sub.accountId ?? options.accounts[0]?.value ?? "" }}
      onSubmit={(v) => recordSubscriptionCharge(v)}
      submitLabel="Record charge"
    />
  );
}
