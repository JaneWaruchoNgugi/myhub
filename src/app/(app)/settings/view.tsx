"use client";
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, KeyRound, Plus, Settings2, Tags, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntityForm } from "@/components/shared/entity-form";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { passwordSchema, preferenceSchema, profileSchema } from "@/lib/validation/productivity";
import { categorySchema } from "@/lib/validation/finance";
import { changePassword, updatePreferences, updateProfile } from "@/server/actions/workspace";
import { createCategory, deleteCategory, updateCategory } from "@/server/actions/accounts";
import { formatMoney } from "@/lib/format";
import type { Prefs } from "@/lib/session";

type Cat = { id: string; name: string; type: string; color: string; isSystem: boolean; count: number };
type Log = { id: string; action: string; entity: string; entityId: string; details: string; when: string; at: string };
type Tab = "profile" | "preferences" | "categories" | "activity";
type Result = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const CURRENCIES = ["KES", "UGX", "TZS", "RWF", "ETB", "NGN", "GHS", "ZAR", "USD", "EUR", "GBP", "AED", "INR", "CAD", "AUD"];
const LOCALES = [
  ["en-KE", "English (Kenya)"],
  ["sw-KE", "Kiswahili (Kenya)"],
  ["en-GB", "English (UK)"],
  ["en-US", "English (US)"],
  ["fr-FR", "Français"],
  ["de-DE", "Deutsch"],
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function submit(fn: () => Promise<Result>, setError?: (k: string, m: string) => void) {
  try {
    const r = await fn();
    if (r.ok) toast.success(r.message ?? "Saved");
    else {
      toast.error(r.error);
      if (r.fieldErrors && setError) for (const [k, v] of Object.entries(r.fieldErrors)) setError(k, v[0]);
    }
    return r.ok;
  } catch {
    toast.error("Network error. Please try again.");
    return false;
  }
}

function Field({ label, error, children, hint, htmlFor }: { label: string; error?: string; children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function SettingsView({ profile, prefs, categories, logs, cron }: { profile: { name: string; email: string; isDemo: boolean; since: string }; prefs: Prefs; categories: Cat[]; logs: Log[]; cron: boolean }) {
  const [tab, setTab] = React.useState<Tab>("profile");
  return (
    <div className="flex flex-col gap-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">
            <User /> Account
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Settings2 /> Preferences
          </TabsTrigger>
          <TabsTrigger value="categories">
            <Tags /> Categories
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History /> Activity log
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "profile" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileCard profile={profile} />
          <PasswordCard disabled={profile.isDemo} />
        </div>
      ) : null}
      {tab === "preferences" ? <PreferencesCard prefs={prefs} cron={cron} /> : null}
      {tab === "categories" ? <CategoriesCard rows={categories} /> : null}
      {tab === "activity" ? <ActivityCard rows={logs} /> : null}
    </div>
  );
}

function ProfileCard({ profile }: { profile: { name: string; email: string; isDemo: boolean; since: string } }) {
  const f = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: profile.name } });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Member since {profile.since}.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={f.handleSubmit((v) => submit(() => updateProfile(v), (k, m) => f.setError(k as "name", { message: m })))}>
          <Field label="Name" htmlFor="p-name" error={f.formState.errors.name?.message}>
            <Input id="p-name" {...f.register("name")} autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="p-email" hint="Your sign-in email can't be changed here.">
            <Input id="p-email" value={profile.email} disabled readOnly />
          </Field>
          {profile.isDemo ? <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">You're using the shared demo account. Its data is sample data and can be reset at any time by re-running the seed script.</p> : null}
          <div>
            <Button type="submit" disabled={f.formState.isSubmitting || !f.formState.isDirty}>
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard({ disabled }: { disabled: boolean }) {
  const f = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const e = f.formState.errors;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" /> Password
        </CardTitle>
        <CardDescription>Use at least 10 characters. A passphrase of several words works well.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={f.handleSubmit(async (v) => {
            if (await submit(() => changePassword(v), (k, m) => f.setError(k as "currentPassword", { message: m }))) f.reset();
          })}
        >
          <Field label="Current password" htmlFor="pw-cur" error={e.currentPassword?.message}>
            <Input id="pw-cur" type="password" autoComplete="current-password" disabled={disabled} {...f.register("currentPassword")} />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={e.newPassword?.message}>
            <Input id="pw-new" type="password" autoComplete="new-password" disabled={disabled} {...f.register("newPassword")} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-conf" error={e.confirmPassword?.message}>
            <Input id="pw-conf" type="password" autoComplete="new-password" disabled={disabled} {...f.register("confirmPassword")} />
          </Field>
          <div>
            <Button type="submit" disabled={disabled || f.formState.isSubmitting}>
              Change password
            </Button>
            {disabled ? <p className="text-muted-foreground mt-2 text-xs">The demo account's password can't be changed.</p> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PreferencesCard({ prefs, cron }: { prefs: Prefs; cron: boolean }) {
  const f = useForm({ resolver: zodResolver(preferenceSchema), defaultValues: prefs });
  const zones = React.useMemo(() => {
    try {
      const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
      return all.includes(prefs.timezone) ? all : [prefs.timezone, ...all];
    } catch {
      return [prefs.timezone, "Africa/Nairobi", "UTC"];
    }
  }, [prefs.timezone]);
  const currencies = CURRENCIES.includes(prefs.currency) ? CURRENCIES : [prefs.currency, ...CURRENCIES];
  const e = f.formState.errors;
  const cur = f.watch("currency");
  const loc = f.watch("locale");
  let sample = "";
  try {
    sample = formatMoney(1234567.5, { currency: cur, locale: loc });
  } catch {
    sample = "";
  }
  const sel = (name: "currency" | "timezone" | "locale" | "weekStartsOn", options: [string, string][]) => (
    <Controller
      control={f.control}
      name={name}
      render={({ field }) => (
        <Select value={String(field.value)} onValueChange={(v) => field.onChange(name === "weekStartsOn" ? Number(v) : v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
  const num = (name: "budgetAlertThreshold" | "billReminderDays" | "loanReminderDays" | "taskReminderDays" | "projectReminderDays", label: string, hint: string) => (
    <Field label={label} htmlFor={`pref-${name}`} error={e[name]?.message} hint={hint}>
      <Input id={`pref-${name}`} type="number" inputMode="numeric" {...f.register(name, { valueAsNumber: true })} />
    </Field>
  );
  return (
    <form onSubmit={f.handleSubmit((v) => submit(() => updatePreferences(v), (k, m) => f.setError(k as "currency", { message: m })))} className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Region and currency</CardTitle>
          <CardDescription>Amounts are stored as entered; changing currency changes how they're labelled, it doesn't convert them.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Currency" error={e.currency?.message} hint={sample ? `Example: ${sample}` : undefined}>
            {sel("currency", currencies.map((c) => [c, c]))}
          </Field>
          <Field label="Number and date format" error={e.locale?.message}>
            {sel("locale", LOCALES.some((l) => l[0] === prefs.locale) ? (LOCALES as [string, string][]) : [[prefs.locale, prefs.locale], ...(LOCALES as [string, string][])])}
          </Field>
          <Field label="Timezone" error={e.timezone?.message} hint="Used for 'today', due dates, reminders and the calendar.">
            {sel("timezone", zones.map((z) => [z, z.replace(/_/g, " ")]))}
          </Field>
          <Field label="Week starts on">{sel("weekStartsOn", DAYS.map((d, i) => [String(i), d]))}</Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerts and reminders</CardTitle>
          <CardDescription>
            In-app notifications only. They're generated when you open MYHUB{cron ? " and by the scheduled job" : ""}. {cron ? "" : "Set CRON_SECRET and schedule /api/cron/run to generate them while you're away."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {num("budgetAlertThreshold", "Budget warning at (%)", "Warn when a category reaches this share of its limit.")}
          {num("billReminderDays", "Bill reminders (days before)", "0 = on the due date.")}
          {num("loanReminderDays", "Loan reminders (days before)", "For your next instalment.")}
          {num("taskReminderDays", "Task reminders (days before)", "Default when a task has no reminder.")}
          {num("projectReminderDays", "Project deadline reminders (days)", "Before a project deadline.")}
        </CardContent>
      </Card>
      <div className="lg:col-span-2">
        <Button type="submit" disabled={f.formState.isSubmitting || !f.formState.isDirty}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}

const TYPE_OPTS = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
];

function CategoriesCard({ rows }: { rows: Cat[] }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Cat | null>(null);
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q),
    filters: [{ key: "type", label: "Types", options: TYPE_OPTS, test: (r, v) => r.type === v }],
    sorts: [
      { key: "name", label: "Name", compare: (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name) },
      { key: "used", label: "Most used", compare: (a, b) => b.count - a.count },
    ],
    pageSize: 30,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transaction categories</CardTitle>
        <CardDescription>Categories used by transactions, budgets, bills and reports. Deleting a category keeps its transactions as uncategorised.</CardDescription>
      </CardHeader>
      <CardContent>
        <ListToolbar controls={c} placeholder="Search categories">
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add category
          </Button>
        </ListToolbar>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.pageItems.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: cat.color }} />
                    <span className="font-medium">{cat.name}</span>
                    {cat.isSystem ? (
                      <Badge variant="outline" title="Used automatically by loans or investments">
                        system
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={cat.type === "INCOME" ? "success" : "secondary"}>{cat.type.toLowerCase()}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{cat.count}</TableCell>
                <TableCell>
                  <RowActions
                    onEdit={() => setEditing(cat)}
                    onDelete={() => deleteCategory(cat.id)}
                    deleteTitle={`Delete "${cat.name}"?`}
                    deleteDescription={cat.count ? `${cat.count} transaction(s) will become uncategorised and it will be removed from budgets.${cat.isSystem ? " MYHUB recreates system categories when needed." : ""}` : "It will be removed from any budgets."}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      </CardContent>
      <EntityForm
        open={adding}
        onOpenChange={setAdding}
        title="Add category"
        schema={categorySchema}
        fields={[
          { name: "name", label: "Name", type: "text", span: 2 },
          { name: "type", label: "Type", type: "select", options: TYPE_OPTS },
          { name: "color", label: "Colour", type: "color" },
        ]}
        defaultValues={{ name: "", type: "EXPENSE", color: "#6366f1" }}
        onSubmit={(v) => createCategory(v)}
      />
      <EntityForm
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit category"
        schema={categorySchema.omit({ type: true })}
        fields={[
          { name: "name", label: "Name", type: "text", span: 2 },
          { name: "color", label: "Colour", type: "color" },
        ]}
        defaultValues={{ name: editing?.name ?? "", color: editing?.color ?? "#6366f1" }}
        onSubmit={(v) => updateCategory(editing!.id, v)}
      />
    </Card>
  );
}

const ACTION_BADGE: Record<string, "success" | "info" | "danger" | "secondary"> = { create: "success", upload: "success", update: "info", delete: "danger" };

function ActivityCard({ rows }: { rows: Log[] }) {
  const entities = React.useMemo(() => [...new Set(rows.map((r) => r.entity))].sort(), [rows]);
  const c = useListControls(rows, {
    search: (r, q) => r.entity.toLowerCase().includes(q) || r.action.toLowerCase().includes(q) || r.details.toLowerCase().includes(q),
    filters: [
      { key: "entity", label: "Records", options: entities.map((e) => ({ value: e, label: e })), test: (r, v) => r.entity === v },
      { key: "action", label: "Actions", options: [...new Set(rows.map((r) => r.action))].map((a) => ({ value: a, label: a })), test: (r, v) => r.action === v },
    ],
    pageSize: 25,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity log</CardTitle>
        <CardDescription>Financial changes and security events on your account (latest 300).</CardDescription>
      </CardHeader>
      <CardContent>
        <ListToolbar controls={c} placeholder="Search activity" />
        {c.total === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No activity recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead className="hidden md:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.pageItems.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground text-sm">{l.when}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_BADGE[l.action] ?? "secondary"}>{l.action}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{l.entity}</TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-md truncate font-mono text-xs md:table-cell" title={l.details}>
                    {l.details}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      </CardContent>
    </Card>
  );
}
