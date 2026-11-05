import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  if (process.env.ALLOW_REGISTRATION !== "true")
    return (
      <div>
        <h1 className="text-2xl font-semibold">Registration is closed</h1>
        <p className="text-muted-foreground mt-2 text-sm">This MYHUB server doesn't accept new accounts. Set ALLOW_REGISTRATION=true to enable sign-ups.</p>
      </div>
    );
  return <RegisterForm />;
}
