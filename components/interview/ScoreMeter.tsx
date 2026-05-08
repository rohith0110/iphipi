import { cn } from "@/lib/utils";

export function ScoreMeter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-ink-400">
          {label}
        </span>
        <span className="font-mono text-base font-medium text-ink-100">{Math.round(pct)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-ink-800">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            accent ? "bg-accent" : "bg-ink-200",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
