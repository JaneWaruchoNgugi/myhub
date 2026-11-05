import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">It may have been deleted, or it belongs to another account.</p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
