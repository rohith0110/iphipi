"use client";
import { useRef, useState } from "react";
import { Upload, FileCheck2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ResumeAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ResumeUpload({
  onParsed,
}: {
  onParsed: (r: ResumeAnalysis) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setFilename(file.name);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      onParsed(data as ResumeAnalysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse resume");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-ink-700 bg-ink-900/40 p-12 text-center transition-all duration-200",
          "hover:border-ink-500 hover:bg-ink-900/70 active:scale-[0.995]",
          dragging && "border-accent bg-accent/5",
          loading && "pointer-events-none opacity-70",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-ink-800">
          {filename && !loading ? (
            <FileCheck2 className="h-5 w-5 text-accent" />
          ) : (
            <Upload className="h-5 w-5 text-ink-300" />
          )}
        </div>
        <div className="font-display text-xl text-ink-50">
          {loading ? "Reading…" : filename ?? "Drop your resume"}
        </div>
        <div className="mt-1.5 text-sm text-ink-400">
          PDF or plain text · we never store the file
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-5"
          onClick={(e) => {
            e.preventDefault();
            inputRef.current?.click();
          }}
          loading={loading}
        >
          Choose file
        </Button>
      </label>
      {error && (
        <div className="flex items-start gap-2 rounded border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
