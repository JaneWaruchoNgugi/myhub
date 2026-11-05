import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/10 text-primary dark:bg-primary/20",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground",
      success: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      warning: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
      danger: "border-transparent bg-red-500/10 text-red-700 dark:text-red-400",
      info: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
