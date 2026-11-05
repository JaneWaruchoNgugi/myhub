import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <LoginForm
      allowRegistration={process.env.ALLOW_REGISTRATION === "true"}
      showDemo={process.env.SHOW_DEMO_HINT === "true"}
      notice={expired ? "Your session ended (for example, your password was changed). Please sign in again." : undefined}
    />
  );
}
