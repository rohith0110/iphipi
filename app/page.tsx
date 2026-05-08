import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

const features = [
  {
    n: "01",
    title: "Resume → role inference",
    body: "Parses the document, extracts evidence, and pins down 3–5 roles you can actually land — with the gaps an interviewer will press on.",
  },
  {
    n: "02",
    title: "Adaptive orchestrator",
    body: "An agent loop, not a script. Bombs the foundations question? It backs off. Crushes a system-design? It ramps. Mixes technical, behavioural, and project-deep-dive.",
  },
  {
    n: "03",
    title: "Multimodal scoring",
    body: "Deepgram for speech, motion-heuristics for posture & engagement, Gemini for technical depth. Three numbers, one truth.",
  },
  {
    n: "04",
    title: "Job recommendations",
    body: "Pulls live postings via JSearch, ranks them against your resume, and tells you exactly why each one fits.",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-150 w-200 -translate-x-1/2 rounded-full bg-accent/10 blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,#0a0a0a_85%)]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link
            href="#how"
            className="rounded-sm px-3 py-1.5 text-xs uppercase tracking-widest text-ink-400 transition-colors hover:text-ink-100 cursor-pointer"
          >
            How it works
          </Link>
          <Link
            href="/dashboard"
            className="rounded-sm px-3 py-1.5 text-xs uppercase tracking-widest text-ink-400 transition-colors hover:text-ink-100 cursor-pointer"
          >
            Open app
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-slow" />
          Hackathon build · v0.1
        </div>

        <h1 className="font-display text-[clamp(2.4rem,7vw,5.6rem)] leading-[0.95] tracking-tight text-ink-50">
          The interview
          <br />
          <span className="italic text-ink-300">that interviews you</span>
          <span className="text-accent">.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-200">
          An agent that reads your resume, infers what you can realistically be
          hired for, then runs an adaptive mock interview across audio, video,
          and text. Get a coaching report that names specific gaps — not
          generic advice.
        </p>

        <div className="mt-10 flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="accent" size="lg">
              Upload resume → Begin
            </Button>
          </Link>
          <Link href="#how">
            <Button variant="outline" size="lg">
              How it works
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-3 divide-x divide-ink-800 border-y border-ink-800">
          {[
            ["6–8", "adaptive questions"],
            ["3", "scoring dimensions"],
            ["~60s", "per-question loop"],
          ].map(([k, v]) => (
            <div key={v} className="px-6 py-5">
              <div className="font-display text-3xl text-ink-50">{k}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-ink-500">
                {v}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl border-ink-800 px-6 py-24">
        <div className="mb-14 flex items-end justify-between">
          <h2 className="font-display text-4xl tracking-tight text-ink-50">
            Architecture, in four moves
          </h2>
          <span className="hidden font-mono text-xs uppercase tracking-widest text-ink-500 md:block">
            02 · pipeline
          </span>
        </div>

        <div className="grid gap-px bg-ink-800 sm:grid-cols-2">
          {features.map((f) => (
            <article
              key={f.n}
              className="group relative bg-ink-950 p-8 transition-colors hover:bg-ink-900"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs text-ink-500">{f.n}</span>
                <span className="h-px w-8 bg-ink-700 transition-all duration-500 group-hover:w-16 group-hover:bg-accent" />
              </div>
              <h3 className="mb-3 font-display text-2xl text-ink-50">{f.title}</h3>
              <p className="text-base leading-relaxed text-ink-300">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl border-t border-ink-800 px-6 py-24">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-ink-500">03 · stack</span>
            <h2 className="mt-4 font-display text-4xl tracking-tight text-ink-50">
              Wired with the things that work.
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-px self-end bg-ink-800">
            {[
              ["Gemini 2.5", "Reasoning + JSON"],
              ["Deepgram", "Live STT + filler-word detection"],
              ["JSearch", "Live job aggregation"],
              ["Heuristic CV", "Motion → engagement & composure"],
              ["Next.js 15", "App Router + server actions"],
              ["Tailwind 3", "All component-scoped"],
            ].map(([k, v]) => (
              <li key={k} className="bg-ink-950 px-5 py-4">
                <div className="text-sm text-ink-100">{k}</div>
                <div className="text-xs text-ink-500">{v}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
          <Logo />
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">
            Built for the hackathon · 2026
          </span>
        </div>
      </footer>
    </main>
  );
}
