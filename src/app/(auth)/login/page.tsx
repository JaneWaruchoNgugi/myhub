import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <LoginForm allowRegistration={process.env.ALLOW_REGISTRATION === "true"} showDemo={process.env.SHOW_DEMO_HINT === "true"} />;
}
