"use client";
import type { InterviewSession, ResumeAnalysis, JobMatch } from "./types";

const KEYS = {
  resume: "iphipi:resume",
  jobs: "iphipi:jobs",
  session: "iphipi:session",
  report: "iphipi:report",
} as const;

function safe<T>(fn: () => T | null): T | null {
  if (typeof window === "undefined") return null;
  try {
    return fn();
  } catch {
    return null;
  }
}

export const store = {
  setResume(r: ResumeAnalysis) {
    safe(() => sessionStorage.setItem(KEYS.resume, JSON.stringify(r)));
  },
  getResume(): ResumeAnalysis | null {
    return safe(() => {
      const raw = sessionStorage.getItem(KEYS.resume);
      return raw ? (JSON.parse(raw) as ResumeAnalysis) : null;
    });
  },
  setJobs(j: JobMatch[]) {
    safe(() => sessionStorage.setItem(KEYS.jobs, JSON.stringify(j)));
  },
  getJobs(): JobMatch[] | null {
    return safe(() => {
      const raw = sessionStorage.getItem(KEYS.jobs);
      return raw ? (JSON.parse(raw) as JobMatch[]) : null;
    });
  },
  setSession(s: InterviewSession) {
    safe(() => sessionStorage.setItem(KEYS.session, JSON.stringify(s)));
  },
  getSession(): InterviewSession | null {
    return safe(() => {
      const raw = sessionStorage.getItem(KEYS.session);
      return raw ? (JSON.parse(raw) as InterviewSession) : null;
    });
  },
  setReport(r: unknown) {
    safe(() => sessionStorage.setItem(KEYS.report, JSON.stringify(r)));
  },
  getReport<T>(): T | null {
    return safe(() => {
      const raw = sessionStorage.getItem(KEYS.report);
      return raw ? (JSON.parse(raw) as T) : null;
    });
  },
  clear() {
    safe(() => {
      Object.values(KEYS).forEach((k) => sessionStorage.removeItem(k));
      return null;
    });
  },
};
