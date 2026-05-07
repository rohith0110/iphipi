import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-2 cursor-pointer select-none transition-opacity hover:opacity-80",
        className,
      )}
    >
      <span className="grid h-7 w-7 place-items-center rounded-sm bg-ink-50 text-ink-950 font-mono text-[11px] font-bold tracking-tighter group-active:scale-95 transition-transform">
        IP
      </span>
      <span className="font-mono text-sm tracking-[0.18em] text-ink-100">
        IPHIPI<span className="text-accent">.</span>
      </span>
    </Link>
  );
}
