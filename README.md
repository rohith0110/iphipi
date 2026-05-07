# IPHIPI · Intelligent Mock Interview Agent

An agentic mock-interview platform that ingests a resume, infers realistic target roles, runs an adaptive multimodal interview, and produces an explainable coaching report.

> Built for the hackathon problem statement: **"Intelligent Mock Interview Agent"**.

---

## 1. Quick start

### Prerequisites

- Node.js 18+ (tested on Node 24)
- pnpm 9+
- A Google Gemini API key — free at https://aistudio.google.com/app/apikey
- The Deepgram and JSearch keys are already pre-filled in `.env.local`

### Setup

```powershell
# 1. Install
pnpm install

# 2. Open .env.local and paste your Gemini key into GEMINI_API_KEY
#    (Deepgram + JSearch keys are already populated)

# 3. Run dev server
pnpm dev

# 4. Open http://localhost:3000
```

### One-command run

```powershell
pnpm dev
```

That's it. No database, no extra services, no docker.

---

## 2. User journey

1. **Land** on the homepage, click **Upload resume → Begin**.
2. **Drop a PDF/text resume** on the dashboard.
   - Server extracts text via `pdf-parse` and asks Gemini to infer skills, seniority, domain, and 3–5 realistic target roles.
   - In parallel, JSearch returns ~15 live postings keyed off the top inferred roles, then Gemini scores each one against the candidate profile.
3. **Pick the role** you're training for, hit **Start adaptive interview**.
4. **Grant camera + mic.** The interview studio opens.
5. **Adaptive loop** — for each question:
   - Click **Begin answer** → Deepgram streams a live transcript with filler-word counting.
   - The candidate's webcam is analysed in-browser at 4 fps for engagement, composure, posture, and stress (browser `FaceDetector` + brightness/motion heuristics — no model download).
   - Click **Submit answer** → Gemini evaluates the transcript against the question's expected concepts, the orchestrator adapts difficulty, and the next question is generated.
6. After ~6–8 questions the **report page** renders an explainable verdict with per-question detail.

---

## 3. Project structure

```
src/
├── app/
│   ├── page.tsx                          # landing
│   ├── dashboard/page.tsx                # resume + jobs + role selection
│   ├── interview/page.tsx                # live interview studio
│   ├── report/page.tsx                   # final report
│   └── api/
│       ├── resume/parse/route.ts         # PDF → ResumeAnalysis (Gemini)
│       ├── jobs/recommend/route.ts       # resume + JSearch → ranked JobMatch[] (Gemini)
│       ├── interview/
│       │   ├── question/route.ts         # adaptive next-question generator (Gemini)
│       │   ├── evaluate/route.ts         # per-answer scoring (Gemini + Deepgram heuristics)
│       │   ├── transcribe/route.ts       # fallback Deepgram REST transcribe
│       │   └── report/route.ts           # final feedback report (Gemini)
│       └── deepgram/token/route.ts       # ephemeral key for browser STT
├── components/
│   ├── ui/Button.tsx, Card.tsx           # primitives
│   ├── Logo.tsx
│   ├── dashboard/{ResumeUpload, RoleCard, JobCard}.tsx
│   └── interview/ScoreMeter.tsx
├── hooks/
│   ├── useDeepgramStream.ts              # live STT + filler-word capture
│   └── useVisualMetrics.ts               # browser CV: face detection + motion/brightness heuristics
├── lib/
│   ├── gemini.ts                         # JSON-mode Gemini wrapper
│   ├── deepgram.ts                       # transcript analysis + comm/confidence scoring
│   ├── jsearch.ts                        # RapidAPI JSearch client
│   ├── pdf.ts                            # pdf-parse wrapper
│   ├── session-store.ts                  # sessionStorage-backed state
│   ├── types.ts                          # all interview/job/report types
│   └── utils.ts
└── globals.css                           # tiny: tailwind directives + base only
```

All component-level styles live inside the TSX as Tailwind classes — `globals.css` only carries directives, base, and a film-grain overlay.

---

## 4. Agent / module map

| # | Module                  | Implementation                                                                         |
|---|-------------------------|----------------------------------------------------------------------------------------|
| 1 | Context Understanding   | `api/resume/parse` — Gemini structured output: skills, domain, seniority, inferred roles, focus areas |
| 2 | Interview Orchestrator  | `api/interview/question` — looks at last answer scores, current difficulty, asked types, then chooses next question + adapts difficulty 1–5 |
| 3 | Audio Intelligence      | `useDeepgramStream` (live) + `lib/deepgram.ts::analyzeTranscript` → WPM, filler ratio, confidence, hesitation count → `communicationScore` |
| 4 | Visual Intelligence     | `useVisualMetrics` — heuristic CV: browser `FaceDetector` for face presence + iris-center deviation, brightness variance, frame-to-frame motion → engagement / composure / posture / stress |
| 5 | Technical Evaluation    | `api/interview/evaluate` — Gemini scores correctness + depth, identifies missing concepts, drafts ideal answer |
| 6 | Feedback & Coaching     | `api/interview/report` — aggregates per-answer scores, weights `0.5·tech + 0.25·comm + 0.25·conf`, produces specific (not generic) coaching |
| 7 | Job Recommendations     | `api/jobs/recommend` — JSearch fanout → Gemini ranks each job 0–100 with 3 fit reasons |

---

## 5. Scoring approach

Per answer, three signals are produced and combined:

```
technical    = mean(correctness_score, depth_score)        // Gemini
communication = clarity·40 + pace·30 + fluency·30 − filler_penalty   // from Deepgram metrics
confidence    = audio_confidence + visual(engagement, composure − stress) // multimodal
```

Final `overall_score = 0.5·technical + 0.25·communication + 0.25·confidence`.

The orchestrator's adaptation rule:

- last `correctness_score < 40` → drop difficulty by 1, switch to a foundational question, inject brief encouragement
- last `correctness_score > 80` → raise difficulty by 1, ask system-design / edge-case
- type mix enforced: at least one behavioural in 6, no consecutive duplicates

---

## 6. Design choices & trade-offs

- **Gemini 2.5 Flash** for every reasoning call — free tier, sub-second JSON. Single provider keeps prompts unified.
- **Deepgram Nova-2 streaming** over Whisper — Whisper is batch-only; Deepgram gives interim results, word-level confidence, and `filler_words: true` for hesitation scoring.
- **Heuristic CV in browser** (`FaceDetector` + brightness/motion) — explicitly allowed by the problem statement ("Simplified CV models acceptable, heuristics-based scoring"). Zero server cost, no WASM download. Falls back to motion-only if `FaceDetector` is missing (Firefox).
- **No database** — sessions live in `sessionStorage`. Avoids a Convex / DB dependency for the hackathon. State is small (~50KB max).
- **No auth** — the single-user demo flow does not need it.

### Limitations / next steps

- Heuristic CV is coarser than MediaPipe FaceMesh; swapping in `@mediapipe/tasks-vision` would give iris landmarks for true eye-contact detection.
- Deepgram key is shipped to the browser. Production should mint short-lived keys via `keys/short-lived`.
- No persistence across sessions — adding Convex (already a dep) would unlock historical performance tracking.

---

## 7. Sample inputs / outputs

After parsing a backend-leaning resume the system typically returns:

```json
{
  "seniority": "junior",
  "domain": "backend",
  "skills": { "strong": ["Node.js","PostgreSQL","REST"], "moderate": ["Docker"], "weak": ["distributed systems","caching"] },
  "inferred_roles": [
    { "title": "Junior Backend Engineer", "confidence": 86, "fit_reason": "Strong evidence of Node + Postgres in 2 shipped projects", ... },
    { "title": "Backend Software Engineer (FinTech)", "confidence": 72, ... }
  ]
}
```

A typical report after a 7-question interview:

```json
{
  "overall_score": 71,
  "hire_recommendation": "yes",
  "top_3_improvements": [
    "Quantify project impact — 'reduced query latency from 800ms to 120ms' lands harder than 'improved performance'",
    "Cut filler words; you averaged 11/answer — the longest pause was 3.2s",
    "Address eye contact — composure dropped to 0.41 on system-design questions"
  ]
}
```

---

## 8. Architecture diagram

```
┌────────── browser (Next.js client) ──────────┐
│  ResumeUpload   InterviewStudio   Report     │
│       │              │   ▲                   │
│       │              │   │ live signals      │
│       │              ▼   │                   │
│       │   useDeepgramStream  useVisualMetrics│
│       │   (WebSocket)        (Canvas + FaceDetector)
└───────┼──────────────┼────────────────────────┘
        │              │
        ▼              ▼
┌──────────────── Next.js API routes ──────────┐
│ /resume/parse   /interview/question          │
│ /jobs/recommend /interview/evaluate          │
│ /deepgram/token /interview/report            │
└────┬──────────────┬────────────┬─────────────┘
     │              │            │
     ▼              ▼            ▼
  Gemini         Deepgram     JSearch
  2.5 Flash      Nova-2       (RapidAPI)
```

---

## 9. License

MIT — built for hackathon evaluation.
