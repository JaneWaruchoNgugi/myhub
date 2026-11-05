"use client";
import { EntityForm, type FieldDef } from "@/components/shared/entity-form";
import { usePrefs } from "@/components/providers";
import { todayStr } from "@/lib/today";
import { accountSchema, assetSchema, contributionSchema, liabilitySchema, recurringSchema, savingsGoalSchema, transactionSchema } from "@/lib/validation/finance";
import { createAccount, updateAccount } from "@/server/actions/accounts";
import { createTransaction, createRecurring, updateRecurring, updateTransaction } from "@/server/actions/transactions";
import { addContribution, createGoal, updateGoal } from "@/server/actions/savings";
import { saveAsset, saveLiability } from "@/server/actions/networth";
import { ACCOUNT_TYPE_OPTS, ASSET_TYPE_OPTS, FREQ_OPTS, GOAL_STATUS_OPTS, LIABILITY_TYPE_OPTS, PRIORITY_OPTS, type FinanceOptions } from "./options";

type Base = { open: boolean; onOpenChange: (o: boolean) => void; onSuccess?: () => void };
type Init = Record<string, unknown> & { id?: string };

const TXN_TYPES = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer between accounts" },
];

function txnFields(o: FinanceOptions, lockType = false): FieldDef[] {
  return [
    ...(lockType ? [] : [{ name: "type", label: "Type", type: "select", options: TXN_TYPES, span: 2 } as FieldDef]),
    { name: "amount", label: "Amount", type: "money", placeholder: "0.00" },
    { name: "date", label: "Date", type: "date" },
    { name: "description", label: "Description", type: "text", placeholder: "e.g. Naivas groceries", span: 2 },
    { name: "accountId", label: "Account", type: "select", options: o.accounts, hidden: (v) => v.type === "TRANSFER" },
    { name: "accountId", label: "From account", type: "select", options: o.accounts, hidden: (v) => v.type !== "TRANSFER" },
    { name: "toAccountId", label: "To account", type: "select", options: o.accounts, hidden: (v) => v.type !== "TRANSFER" },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      allowNone: "Uncategorised",
      options: (v) => (v.type === "INCOME" ? o.incomeCategories : o.expenseCategories),
      hidden: (v) => v.type === "TRANSFER",
    },
    { name: "notes", label: "Notes", type: "textarea", rows: 2, placeholder: "Optional" },
  ];
}

export function TransactionDialog({ options, initial, defaultType = "EXPENSE", ...p }: Base & { options: FinanceOptions; initial?: Init; defaultType?: "INCOME" | "EXPENSE" | "TRANSFER" }) {
  const prefs = usePrefs();
  const id = initial?.id;
  const type = (initial?.type as string) ?? defaultType;
  const title = id ? "Edit transaction" : type === "INCOME" ? "Add income" : type === "TRANSFER" ? "Transfer money" : "Add expense";
  return (
    <EntityForm
      {...p}
      title={title}
      description={type === "TRANSFER" ? "Moves money between your accounts. Doesn't count as income or expense." : undefined}
      schema={transactionSchema}
      fields={txnFields(options)}
      defaultValues={{ type, amount: "", date: todayStr(prefs.timezone), description: "", accountId: options.accounts[0]?.value ?? "", toAccountId: "", categoryId: "", notes: "", ...initial }}
      onSubmit={(v) => (id ? updateTransaction(id, v) : createTransaction(v))}
      submitLabel={id ? "Save changes" : "Save"}
    />
  );
}

export function RecurringDialog({ options, initial, ...p }: Base & { options: FinanceOptions; initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit recurring transaction" : "New recurring transaction"}
      description="Occurrences are added automatically on their dates (when you open MYHUB, or via the scheduled job)."
      schema={recurringSchema}
      fields={[
        { name: "type", label: "Type", type: "select", options: TXN_TYPES, span: 2 },
        { name: "amount", label: "Amount", type: "money" },
        { name: "frequency", label: "Repeats", type: "select", options: FREQ_OPTS },
        { name: "description", label: "Description", type: "text", placeholder: "e.g. Salary, Rent", span: 2 },
        { name: "accountId", label: "Account", type: "select", options: options.accounts },
        { name: "toAccountId", label: "To account", type: "select", options: options.accounts, hidden: (v) => v.type !== "TRANSFER" },
        { name: "categoryId", label: "Category", type: "select", allowNone: "Uncategorised", options: (v) => (v.type === "INCOME" ? options.incomeCategories : options.expenseCategories), hidden: (v) => v.type === "TRANSFER" },
        { name: "startDate", label: "First date", type: "date" },
        { name: "endDate", label: "End date (optional)", type: "date" },
        { name: "isActive", label: "Active", type: "switch", description: "Pause to stop generating new occurrences." },
      ]}
      defaultValues={{ type: "EXPENSE", amount: "", frequency: "MONTHLY", description: "", accountId: options.accounts[0]?.value ?? "", toAccountId: "", categoryId: "", startDate: todayStr(prefs.timezone), endDate: "", isActive: true, ...initial }}
      onSubmit={(v) => (id ? updateRecurring(id, v) : createRecurring(v))}
    />
  );
}

export function AccountDialog({ initial, ...p }: Base & { initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit account" : "Add account"}
      description="Balances are calculated from the opening balance plus every transaction."
      schema={accountSchema}
      fields={[
        { name: "name", label: "Account name", type: "text", placeholder: "e.g. M-Pesa, Equity Bank", span: 2 },
        { name: "type", label: "Type", type: "select", options: ACCOUNT_TYPE_OPTS },
        { name: "institution", label: "Institution", type: "text", placeholder: "Optional" },
        { name: "openingBalance", label: "Opening balance", type: "text", description: "Balance on the opening date. Can be negative." },
        { name: "openingDate", label: "Opening date", type: "date" },
        { name: "color", label: "Colour", type: "color" },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
        ...(id ? [{ name: "isArchived", label: "Archived", type: "switch", description: "Hidden from forms, kept in history and net worth." } as FieldDef] : []),
      ]}
      defaultValues={{ name: "", type: "BANK", institution: "", openingBalance: "0", openingDate: todayStr(prefs.timezone), color: "#6366f1", notes: "", isArchived: false, ...initial }}
      onSubmit={(v) => (id ? updateAccount(id, v) : createAccount(v))}
    />
  );
}

export function GoalDialog({ options, initial, ...p }: Base & { options: FinanceOptions; initial?: Init }) {
  const id = initial?.id;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit savings goal" : "New savings goal"}
      description="A goal earmarks money inside one of your accounts, so it's never counted twice in net worth."
      schema={savingsGoalSchema}
      fields={[
        { name: "name", label: "Goal name", type: "text", placeholder: "e.g. Emergency fund", span: 2 },
        { name: "targetAmount", label: "Target amount", type: "money" },
        { name: "targetDate", label: "Target date", type: "date" },
        { name: "accountId", label: "Held in account", type: "select", options: options.accounts, span: 2, description: "Usually a savings account or money-market wallet." },
        { name: "priority", label: "Priority", type: "select", options: PRIORITY_OPTS },
        { name: "status", label: "Status", type: "select", options: GOAL_STATUS_OPTS },
        { name: "description", label: "Description", type: "textarea", rows: 2 },
        { name: "isEmergencyFund", label: "This is my emergency fund", type: "switch" },
      ]}
      defaultValues={{ name: "", targetAmount: "", targetDate: "", accountId: options.accounts[0]?.value ?? "", priority: "MEDIUM", status: "ACTIVE", description: "", isEmergencyFund: false, ...initial }}
      onSubmit={(v) => (id ? updateGoal(id, v) : createGoal(v))}
    />
  );
}

export function ContributionDialog({ options, goalId, goalAccountId, type = "CONTRIBUTION", ...p }: Base & { options: FinanceOptions; goalId?: string; goalAccountId?: string; type?: "CONTRIBUTION" | "WITHDRAWAL" }) {
  const prefs = usePrefs();
  const others = options.accounts.filter((a) => a.value !== goalAccountId);
  return (
    <EntityForm
      {...p}
      title={type === "CONTRIBUTION" ? "Add to savings" : "Withdraw from savings"}
      description={
        type === "CONTRIBUTION"
          ? "Pick a 'from' account to move money into the goal's account. Leave it empty if the money is already sitting in that account."
          : "Pick where the money goes. Leave it empty to just release the earmark (money stays in the account)."
      }
      schema={contributionSchema}
      fields={[
        ...(goalId ? [] : [{ name: "goalId", label: "Goal", type: "select", options: options.goals, span: 2 } as FieldDef]),
        { name: "amount", label: "Amount", type: "money" },
        { name: "date", label: "Date", type: "date" },
        { name: "otherAccountId", label: type === "CONTRIBUTION" ? "Move from account" : "Move to account", type: "select", allowNone: type === "CONTRIBUTION" ? "Already in the goal's account" : "Keep in the goal's account", options: goalAccountId ? others : options.accounts, span: 2 },
        { name: "note", label: "Note", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ goalId: goalId ?? options.goals[0]?.value ?? "", type, amount: "", date: todayStr(prefs.timezone), otherAccountId: "", note: "" }}
      onSubmit={(v) => addContribution({ ...v, type })}
      submitLabel={type === "CONTRIBUTION" ? "Add contribution" : "Record withdrawal"}
    />
  );
}

export function AssetDialog({ initial, ...p }: Base & { initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit asset" : "Add asset"}
      description="For things not tracked elsewhere: property, vehicles, equipment. Accounts, savings and investments are included automatically."
      schema={assetSchema}
      fields={[
        { name: "name", label: "Name", type: "text", span: 2, placeholder: "e.g. Plot in Kitengela" },
        { name: "type", label: "Type", type: "select", options: ASSET_TYPE_OPTS },
        { name: "value", label: "Current value", type: "money" },
        { name: "valuedAt", label: "Valued on", type: "date" },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ name: "", type: "PROPERTY", value: "", valuedAt: todayStr(prefs.timezone), notes: "", ...initial }}
      onSubmit={(v) => saveAsset(id, v)}
    />
  );
}

export function LiabilityDialog({ initial, ...p }: Base & { initial?: Init }) {
  const prefs = usePrefs();
  const id = initial?.id ?? null;
  return (
    <EntityForm
      {...p}
      title={id ? "Edit liability" : "Add liability"}
      description="For debts not tracked as a loan, like a credit card balance. Loans you borrowed are included automatically."
      schema={liabilitySchema}
      fields={[
        { name: "name", label: "Name", type: "text", span: 2, placeholder: "e.g. KCB credit card" },
        { name: "type", label: "Type", type: "select", options: LIABILITY_TYPE_OPTS },
        { name: "balance", label: "Balance owed", type: "money" },
        { name: "asOf", label: "As of", type: "date" },
        { name: "notes", label: "Notes", type: "textarea", rows: 2 },
      ]}
      defaultValues={{ name: "", type: "CREDIT_CARD", balance: "", asOf: todayStr(prefs.timezone), notes: "", ...initial }}
      onSubmit={(v) => saveLiability(id, v)}
    />
  );
}
