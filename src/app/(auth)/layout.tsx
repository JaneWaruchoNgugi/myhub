import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="bg-sidebar relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 size-[420px] rounded-full bg-sky-500/10 blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight text-white">Every shilling, every goal, every deadline. In one place.</h2>
          <p className="text-sidebar-foreground mt-4 text-base">
            Accounts, budgets, savings, loans, investments, bills, your calendar and your developer workspace, all calculated from your own records.
          </p>
        </div>
        <p className="text-sidebar-muted relative text-xs">Private by design. Your data is isolated to your account.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo dark={false} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
