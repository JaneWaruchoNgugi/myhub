"use client";
import * as React from "react";
import { Controller, useForm, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z, ZodTypeAny } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "textarea" | "code" | "money" | "units" | "number" | "date" | "datetime" | "month" | "select" | "switch" | "tags" | "url" | "color";
  options?: Option[] | ((values: Record<string, unknown>) => Option[]);
  /** For selects: label of an empty choice (stored as ""). */
  allowNone?: string;
  placeholder?: string;
  description?: string;
  span?: 1 | 2;
  rows?: number;
  hidden?: (values: Record<string, unknown>) => boolean;
};

const NONE = "__none__";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export type EntityFormProps<S extends ZodTypeAny> = {
  title: string;
  description?: string;
  schema: S;
  fields: FieldDef[];
  defaultValues: Record<string, unknown>;
  onSubmit: (values: z.output<S>) => Promise<ActionResult>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  submitLabel?: string;
  wide?: boolean;
  onSuccess?: () => void;
  children?: React.ReactNode;
};

export function EntityForm<S extends ZodTypeAny>(props: EntityFormProps<S>) {
  const { title, description, schema, fields, defaultValues, onSubmit, trigger, submitLabel = "Save", wide, onSuccess, children } = props;
  const [innerOpen, setInnerOpen] = React.useState(false);
  const open = props.open ?? innerOpen;
  const setOpen = props.onOpenChange ?? setInnerOpen;

  const form = useForm<FieldValues>({ resolver: zodResolver(schema) as Resolver<FieldValues>, defaultValues });
  const { register, handleSubmit, control, reset, setError, watch, formState } = form;
  const values = watch();
  const defaultsKey = JSON.stringify(defaultValues);

  React.useEffect(() => {
    if (open) reset(JSON.parse(defaultsKey));
  }, [open, defaultsKey, reset]);

  const submit = handleSubmit(async (data) => {
    try {
      const res = await onSubmit(data as z.output<S>);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
        onSuccess?.();
      } else {
        if (res.fieldErrors) for (const [k, v] of Object.entries(res.fieldErrors)) setError(k, { message: v[0] });
        toast.error(res.error);
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={cn(wide ? "max-w-2xl" : "max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 pb-5 sm:grid-cols-2">
            {fields.map((f) => {
              if (f.hidden?.(values)) return null;
              const err = formState.errors[f.name]?.message as string | undefined;
              const id = `f-${f.name}`;
              const full = f.span === 2 || f.type === "textarea" || f.type === "code" || f.type === "switch";
              return (
                <div key={f.name} className={cn("flex flex-col gap-1.5", full && "sm:col-span-2")}>
                  {f.type === "switch" ? (
                    <Controller
                      control={control}
                      name={f.name}
                      render={({ field }) => (
                        <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                          <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{f.label}</span>
                            {f.description ? <span className="text-muted-foreground text-xs">{f.description}</span> : null}
                          </span>
                          <Switch id={id} checked={!!field.value} onCheckedChange={field.onChange} />
                        </label>
                      )}
                    />
                  ) : (
                    <>
                      <Label htmlFor={id}>{f.label}</Label>
                      {f.type === "select" ? (
                        <Controller
                          control={control}
                          name={f.name}
                          render={({ field }) => (
                            <Select value={field.value ? String(field.value) : f.allowNone ? NONE : undefined} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                              <SelectTrigger id={id} aria-invalid={!!err}>
                                <SelectValue placeholder={f.placeholder ?? "Select…"} />
                              </SelectTrigger>
                              <SelectContent>
                                {f.allowNone ? <SelectItem value={NONE}>{f.allowNone}</SelectItem> : null}
                                {(typeof f.options === "function" ? f.options(values) : (f.options ?? [])).map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      ) : f.type === "textarea" || f.type === "code" ? (
                        <Textarea id={id} rows={f.rows ?? 4} placeholder={f.placeholder} aria-invalid={!!err} className={cn(f.type === "code" && "font-mono text-xs")} spellCheck={f.type !== "code"} {...register(f.name)} />
                      ) : (
                        <Input
                          id={id}
                          aria-invalid={!!err}
                          placeholder={f.placeholder}
                          type={
                            f.type === "money" || f.type === "units" || f.type === "tags"
                              ? "text"
                              : f.type === "datetime"
                                ? "datetime-local"
                                : f.type
                          }
                          inputMode={f.type === "money" || f.type === "units" ? "decimal" : f.type === "number" ? "numeric" : undefined}
                          className={cn(f.type === "color" && "h-9 w-20 p-1")}
                          autoComplete={f.type === "password" ? "new-password" : "off"}
                          {...register(f.name)}
                        />
                      )}
                      {f.description && !err ? <p className="text-muted-foreground text-xs">{f.description}</p> : null}
                    </>
                  )}
                  {err ? <p className="text-destructive text-xs">{err}</p> : null}
                </div>
              );
            })}
            {children}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
