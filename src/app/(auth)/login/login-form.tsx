"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ allowRegistration, showDemo, notice }: { allowRegistration: boolean; showDemo: boolean; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-muted-foreground mt-1 text-sm">Sign in to your MYHUB.</p>
      {notice ? <p className="bg-muted text-muted-foreground mt-6 rounded-lg px-3 py-2 text-sm">{notice}</p> : null}
      <form action={action} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state?.error ? (
          <p role="alert" className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-sm">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Sign in
        </Button>
      </form>
      {allowRegistration ? (
        <p className="text-muted-foreground mt-6 text-center text-sm">
          New here?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Create your account
          </Link>
        </p>
      ) : null}
      {showDemo ? (
        <p className="text-muted-foreground bg-muted mt-6 rounded-lg px-3 py-2 text-center text-xs">
          Demo account: <span className="font-mono">demo@myhub.local</span> / <span className="font-mono">demo-password-123</span>
        </p>
      ) : null}
    </div>
  );
}
