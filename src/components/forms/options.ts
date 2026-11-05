import { enumOptions } from "@/lib/utils";
import type { Option } from "@/components/shared/entity-form";

export type FinanceOptions = { accounts: Option[]; incomeCategories: Option[]; expenseCategories: Option[]; goals: Option[]; loans: Option[]; projects: Option[] };

export const ACCOUNT_TYPE_OPTS = enumOptions(["CASH", "BANK", "MOBILE_MONEY", "SAVINGS", "INVESTMENT_CASH", "OTHER"] as const, { INVESTMENT_CASH: "Brokerage cash", MOBILE_MONEY: "Mobile money (M-Pesa etc.)" });
export const FREQ_OPTS = enumOptions(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const, { BIWEEKLY: "Every 2 weeks" });
export const RECURRENCE_OPTS = enumOptions(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const, { NONE: "Does not repeat", BIWEEKLY: "Every 2 weeks" });
export const PRIORITY_OPTS = enumOptions(["LOW", "MEDIUM", "HIGH", "URGENT"] as const);
export const GOAL_STATUS_OPTS = enumOptions(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] as const);
export const LOAN_TYPE_OPTS = enumOptions(["PERSONAL", "BANK", "MOBILE", "CREDIT_CARD", "SACCO", "OTHER"] as const, { MOBILE: "Mobile loan (Fuliza, M-Shwari…)", SACCO: "SACCO" });
export const LOAN_STATUS_OPTS = enumOptions(["ACTIVE", "PAID_OFF", "DEFAULTED", "WRITTEN_OFF"] as const);
export const ASSET_CLASS_OPTS = enumOptions(["STOCK", "ETF", "MONEY_MARKET", "TREASURY_BILL", "GOVERNMENT_BOND", "MUTUAL_FUND", "CRYPTO", "OTHER"] as const, { ETF: "ETF", MONEY_MARKET: "Money market fund", CRYPTO: "Cryptocurrency" });
export const BILL_KIND_OPTS = enumOptions(["RENT", "ELECTRICITY", "WATER", "INTERNET", "PHONE", "SCHOOL_FEES", "INSURANCE", "LOAN_REPAYMENT", "STREAMING", "HOSTING", "OTHER"] as const, { HOSTING: "Hosting & domains", STREAMING: "Streaming" });
export const CYCLE_OPTS = enumOptions(["WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const, { SEMI_ANNUAL: "Every 6 months" });
export const SUB_STATUS_OPTS = enumOptions(["ACTIVE", "TRIAL", "PAUSED", "CANCELLED"] as const);
export const TASK_CATEGORY_OPTS = enumOptions(["PERSONAL", "WORK", "HEALTH", "FINANCE", "LEARNING", "ERRAND", "OTHER"] as const);
export const TASK_STATUS_OPTS = enumOptions(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const, { TODO: "To do" });
export const EVENT_TYPE_OPTS = enumOptions(["APPOINTMENT", "MEETING", "EVENT", "DEADLINE", "REMINDER", "OTHER"] as const);
export const PROJECT_STATUS_OPTS = enumOptions(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const);
export const DEV_TASK_TYPE_OPTS = enumOptions(["IDEA", "FEATURE", "BUG", "IMPROVEMENT", "TECH_DEBT", "RESEARCH"] as const, { TECH_DEBT: "Technical debt" });
export const DEV_TASK_STATUS_OPTS = enumOptions(["IDEAS", "BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "COMPLETED"] as const, { TODO: "To do" });
export const BOOKMARK_CAT_OPTS = enumOptions(["DOCUMENTATION", "REPOSITORY", "TUTORIAL", "ARTICLE", "API", "TOOL", "SNIPPET", "IDEA", "OTHER"] as const, { API: "API", SNIPPET: "Code snippet", IDEA: "Dev idea" });
export const LEARNING_KIND_OPTS = enumOptions(["LANGUAGE", "FRAMEWORK", "TECHNOLOGY", "COURSE", "TUTORIAL", "SKILL"] as const, { LANGUAGE: "Programming language" });
export const LEARNING_STATUS_OPTS = enumOptions(["WANT_TO_LEARN", "LEARNING", "PAUSED", "COMPLETED"] as const);
export const DEV_GOAL_TYPE_OPTS = enumOptions(["BUILD_SAAS", "LEARN_FRAMEWORK", "COMPLETE_COURSE", "OPEN_SOURCE", "DEPLOY_PROJECT", "OTHER"] as const, { BUILD_SAAS: "Build a SaaS", OPEN_SOURCE: "Contribute to open source" });
export const DOC_CAT_OPTS = enumOptions(["RECEIPT", "INVOICE", "CONTRACT", "ID", "TAX", "INSURANCE", "MEDICAL", "EDUCATION", "OTHER"] as const, { ID: "ID / passport" });
export const ASSET_TYPE_OPTS = enumOptions(["PROPERTY", "VEHICLE", "EQUIPMENT", "JEWELLERY", "RECEIVABLE", "OTHER"] as const);
export const LIABILITY_TYPE_OPTS = enumOptions(["CREDIT_CARD", "MORTGAGE", "TAX", "OTHER"] as const, { TAX: "Tax owed" });

export const labelOf = (opts: Option[], v: string | null | undefined) => opts.find((o) => o.value === v)?.label ?? v ?? "—";
