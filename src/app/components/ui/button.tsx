import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-normal tracking-[-0.01em] outline-none transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[2px] aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-primary/35 bg-background text-primary hover:bg-primary/5 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-surface-container-low text-on-surface hover:bg-surface-container",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 px-7 has-[>svg]:px-5",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
      loading?: boolean;
    }
>(({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const showLoadingBar = loading && !asChild;
  const content = showLoadingBar ? (
    <>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-current/20"
      >
        <span className="gc-loading-indicator absolute inset-y-0 left-0 w-1/2 rounded-full bg-current/70" />
      </span>
    </>
  ) : (
    children
  );

  return (
    <Comp
      data-slot="button"
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      ref={ref}
      className={cn(
        buttonVariants({ variant, size, className }),
        showLoadingBar && "relative overflow-hidden",
      )}
      {...props}
    >
      {content}
    </Comp>
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
