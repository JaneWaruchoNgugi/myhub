"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-600">
        <AlertTriangle className="size-5" />
      </div>
      <h2 className="font-semibold">Something went wrong loading this page</h2>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">Your data is safe. Try again, and if it keeps happening check the server logs{error.digest ? ` (ref ${error.digest})` : ""}.</p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
