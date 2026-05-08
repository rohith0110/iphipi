"use client";
import { useEffect, useState } from "react";

const KEY = "iphipi:anonId";

function generate(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useAnonId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = generate();
      localStorage.setItem(KEY, v);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setId(v);
  }, []);
  return id;
}
