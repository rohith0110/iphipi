"use client";

export interface HistoryEntry {
  id: string;
  date: number;
  role: string;
  overall: number;
  technical: number;
  communication: number;
  confidence: number;
  hire: "strong_yes" | "yes" | "maybe" | "no";
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.round(diff / min))}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString();
}

const HIRE_LABEL: Record<HistoryEntry["hire"], string> = {
  strong_yes: "Strong",
  yes: "Hire",
  maybe: "Maybe",
  no: "No",
};

export function HistoryPanel({ entries }: { entries: HistoryEntry[] }) {
  const recent = entries.slice(0, 5);
  const max = Math.max(100, ...recent.map((e) => e.overall));

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
          Past sessions
        </span>
        <span className="font-mono text-[10px] text-ink-600">
          {entries.length} total
        </span>
      </div>

      <div className="mb-4 flex h-8 items-end gap-1">
        {recent
          .slice()
          .reverse()
          .map((e) => (
            <div
              key={e.id}
              className="flex-1 rounded-sm bg-accent/60"
              style={{ height: `${(e.overall / max) * 100}%` }}
              title={`${e.role} · ${Math.round(e.overall)}`}
            />
          ))}
      </div>

      <ul className="space-y-1.5">
        {recent.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 border-t border-ink-800 pt-1.5 text-xs first:border-0 first:pt-0"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-ink-200">{e.role}</div>
              <div className="font-mono text-[10px] text-ink-500">
                {relativeDate(e.date)} · {HIRE_LABEL[e.hire]}
              </div>
            </div>
            <div className="font-mono text-base text-ink-50">
              {Math.round(e.overall)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
