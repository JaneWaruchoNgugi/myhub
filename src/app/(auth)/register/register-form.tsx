"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { registerAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "name", label: "Your name", type: "text", auto: "name" },
  { name: "email", label: "Email", type: "email", auto: "email" },
  { name: "password", label: "Password", type: "password", auto: "new-password", hint: "At least 10 characters." },
  { name: "confirmPassword", label: "Confirm password", type: "password", auto: "new-password" },
];

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, undefined);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your MYHUB</h1>
      <p className="text-muted-foreground mt-1 text-sm">Default currency KES and timezone Africa/Nairobi. You can change both later.</p>
      <form action={action} className="mt-8 flex flex-col gap-4">
        {FIELDS.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input id={f.name} name={f.name} type={f.type} autoComplete={f.auto} required aria-invalid={!!state?.fieldErrors?.[f.name]} />
            {state?.fieldErrors?.[f.name] ? <p className="text-destructive text-xs">{state.fieldErrors[f.name]}</p> : f.hint ? <p className="text-muted-foreground text-xs">{f.hint}</p> : null}
          </div>
        ))}
        {state?.error ? (
          <p role="alert" className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-sm">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Create account
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
