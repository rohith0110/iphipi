"use client";
import { ArrowUpRight, Target } from "lucide-react";
import type { InferredRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RoleCard({
  role,
  selected,
  onSelect,
}: {
  role: InferredRole;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative w-full text-left rounded-lg border bg-ink-900/40 p-5 transition-all duration-200 cursor-pointer active:scale-[0.99]",
        selected
          ? "border-accent shadow-[0_0_0_1px_#FF4D1A,0_0_60px_-20px_#FF4D1A]"
          : "border-ink-800 hover:border-ink-600",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-ink-500">
            {selected ? "Selected" : "Suggested role"}
          </div>
          <h3 className="mt-1 font-display text-xl leading-tight text-ink-50">
            {role.title}
          </h3>
        </div>
        <div className="flex shrink-0 items-baseline gap-1">
          <span className="font-mono text-3xl text-ink-100">
            {role.confidence}
          </span>
          <span className="text-[11px] text-ink-500">/100</span>
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-ink-300">{role.fit_reason}</p>

      <div className="space-y-1.5 border-t border-ink-800 pt-3">
        <div className="flex gap-2">
          <Target className="h-3.5 w-3.5 shrink-0 mt-0.5 text-ink-500" />
          <span className="text-sm text-ink-200">
            {role.interview_focus.core_skills.slice(0, 4).join(" · ")}
          </span>
        </div>
      </div>

      <ArrowUpRight
        className={cn(
          "absolute right-4 top-4 h-4 w-4 transition-all",
          selected ? "text-accent" : "text-ink-600 group-hover:text-ink-300",
        )}
      />
    </button>
  );
}
