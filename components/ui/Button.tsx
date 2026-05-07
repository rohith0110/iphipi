"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "accent";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all duration-150 cursor-pointer select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 focus-visible:ring-ink-300";

    const sizes: Record<string, string> = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    const variants: Record<Variant, string> = {
      primary:
        "bg-ink-50 text-ink-950 hover:bg-white border border-transparent",
      accent:
        "bg-accent text-ink-950 hover:bg-[#ff5c2e] border border-transparent shadow-[0_0_0_0_rgba(255,77,26,0)] hover:shadow-[0_8px_30px_-8px_rgba(255,77,26,0.6)]",
      outline:
        "bg-transparent text-ink-100 border border-ink-700 hover:border-ink-400 hover:bg-ink-900/60",
      ghost:
        "bg-transparent text-ink-200 hover:text-ink-50 hover:bg-ink-900/60 border border-transparent",
    };

    return (
      <button
        ref={ref}
        className={cn(base, sizes[size], variants[variant], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
