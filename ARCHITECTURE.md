# IPHIPI · Architecture

## Problem summary
Design an agentic AI mock-interview platform that ingests a resume, infers realistic target roles, runs an adaptive multimodal interview, and produces an explainable coaching report — covering technical competence, communication, and confidence.

## User journey
Upload resume → get inferred roles + ranked live job postings → pick a role → grant camera/mic → adaptive 6–8-question interview with live transcript, live communication / confidence / engagement meters → final report with per-question detail and three concrete next steps.

## High-level architecture

```
[browser] Resume drop ─┐                                ┌─► Gemini 2.5 Flash (reasoning + JSON)
                       ├─► Next.js API routes ──────────┼─► Deepgram Nova-2 (streaming STT + word conf)
[browser] Live A/V ────┘                                └─► JSearch / RapidAPI (live job postings)

[browser] useDeepgramStream  → live transcript + filler-word & WPM metrics
[browser] useVisualMetrics   → 4 fps Canvas + FaceDetector → engagement / composure / posture / stress
```

Modules map 1:1 with the problem statement:

1. **Context Understanding** → `/api/resume/parse` (Gemini structured JSON: skills, seniority, domain, 3–5 inferred roles, per-role focus areas)
2. **Interview Orchestrator** → `/api/interview/question` (adapts difficulty 1–5 from last-answer scores, enforces type variety)
3. **Audio Intelligence** → `useDeepgramStream` + `lib/deepgram.ts` (filler-word ratio, WPM, word-level confidence → communication score)
4. **Visual Intelligence** → `useVisualMetrics` (browser `FaceDetector` + brightness variance + motion → engagement, composure, posture, stress) — heuristic, no model download, runs in any modern browser
5. **Technical Evaluation** → `/api/interview/evaluate` (Gemini scores correctness + depth, missing concepts, ideal answer)
6. **Feedback & Coaching** → `/api/interview/report` (aggregates per-answer scores, generates specific coaching keyed off the actual transcripts and metrics)

Bonus: **Resume-based job recommendations** → `/api/jobs/recommend` aggregates JSearch postings and uses Gemini to rank them with three concrete fit reasons each.

## Data flow

```
PDF/text  ─► pdf-parse ─► raw text ─► Gemini ─► ResumeAnalysis ──► sessionStorage
                                            │
                                            └─► JSearch fanout ─► Gemini ranker ─► JobMatch[]

Question loop:
  prior session ─► Gemini orchestrator ─► InterviewQuestion
  webcam frames ─► useVisualMetrics ─► VisualMetrics (live, snapshot at submit)
  mic stream ───► Deepgram WebSocket ─► transcript + word confidences
  on submit:  transcript + audio + visual + question ─► /evaluate ─► AnswerEvaluation + combined_score
  loop until 6–8 Qs or `should_end=true`
  /report ─► FinalReport with hire_recommendation
```

## Scoring approach

Per answer:
- `technical    = mean(correctness, depth)`            (Gemini)
- `communication = clarity·40 + pace·30 + fluency·30 − filler_penalty` (Deepgram-driven)
- `confidence   = audio_conf + visual(engagement + composure − stress)` (multimodal)

Aggregate report: `overall = 0.5·technical + 0.25·communication + 0.25·confidence`.

Adaptation rule (orchestrator):
- correctness < 40 → drop difficulty, ask foundational question, inject encouragement
- correctness > 80 → raise difficulty, ask system-design / edge-case
- enforce type mix: ≥1 behavioural per 6, no consecutive duplicate types

## Key design choices & trade-offs

| Choice | Reason | Trade-off |
|---|---|---|
| Gemini 2.5 Flash | Free tier, sub-second JSON, single provider keeps prompt design uniform | Slightly lower reasoning depth than Pro; mitigated with strict JSON schema |
| Deepgram streaming over Whisper | Real-time transcript + word-level confidence + filler-word detection | Adds external WS dependency; key shipped to browser (acceptable for hackathon) |
| Heuristic in-browser CV | Zero server cost, instant, allowed by problem statement | Coarser than MediaPipe FaceMesh; engagement is presence + center-deviation, not iris-tracked |
| sessionStorage instead of DB | One-command run, no service signups | No history across sessions; solvable with Convex (already in deps) |
| Next.js 15 + App Router | Co-locates API + UI, edge-friendly | Heavier than a Python Flask backend; offset by single-process simplicity |

## Limitations / assumptions

- Single-user, single-session demo; no auth.
- Interview tops out at 8 questions for demo pacing.
- Heuristic CV gives directionally-correct scores; absolute values are not calibrated against a benchmark.
- Browser `FaceDetector` is missing in Firefox — falls back to brightness/motion-only metrics.

## Next steps

- Swap `useVisualMetrics` to `@mediapipe/tasks-vision` for iris-tracked eye-contact.
- Mint short-lived Deepgram keys server-side instead of returning the master key.
- Persist `InterviewSession` + `FinalReport` in Convex (already a dep) to enable longitudinal performance tracking.
- Add coding-round simulation (Monaco editor + Gemini-graded test cases).
- Integrate audio emotion model (Hume AI) for tone/pitch nuance.
