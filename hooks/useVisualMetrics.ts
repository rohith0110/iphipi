"use client";
// Heuristic visual analysis. No model download, runs at ~4fps.
// Tracks frame-to-frame motion, brightness stability, and uses the browser
// FaceDetector API where available.
import { useEffect, useRef, useState } from "react";
import type { VisualMetrics } from "@/lib/types";

interface SampleFrame {
  brightness: number;
  motion: number;
  faceCenter?: { x: number; y: number };
  faceSize?: number;
}

export function useVisualMetrics(videoEl: HTMLVideoElement | null, active: boolean) {
  const framesRef = useRef<SampleFrame[]>([]);
  const lastImgDataRef = useRef<Uint8ClampedArray | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<unknown>(null);
  const rafRef = useRef<number | null>(null);
  const [live, setLive] = useState<VisualMetrics>({
    engagement: 0.5,
    composure: 0.5,
    posture: 0.7,
    stress_level: 0.3,
    frame_count: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-expect-error - FaceDetector is experimental
    if (typeof window.FaceDetector === "function") {
      try {
        // @ts-expect-error - FaceDetector
        detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        detectorRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!active || !videoEl) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    framesRef.current = [];

    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let lastSampleAt = 0;
    const interval = 250; // 4fps

    const tick = async (t: number) => {
      if (!active) return;
      if (t - lastSampleAt > interval && videoEl.readyState >= 2) {
        lastSampleAt = t;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = img.data;

        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const brightness = total / (data.length / 4) / 255;

        let motion = 0;
        if (lastImgDataRef.current) {
          const prev = lastImgDataRef.current;
          let diff = 0;
          for (let i = 0; i < data.length; i += 16) {
            diff += Math.abs(data[i] - prev[i]);
          }
          motion = Math.min(1, diff / (data.length / 16) / 60);
        }
        lastImgDataRef.current = new Uint8ClampedArray(data);

        let faceCenter: SampleFrame["faceCenter"];
        let faceSize: number | undefined;
        const det = detectorRef.current as
          | { detect: (s: HTMLCanvasElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> }
          | null;
        if (det) {
          try {
            const faces = await det.detect(canvas);
            if (faces[0]) {
              const b = faces[0].boundingBox;
              faceCenter = {
                x: (b.x + b.width / 2) / canvas.width,
                y: (b.y + b.height / 2) / canvas.height,
              };
              faceSize = (b.width * b.height) / (canvas.width * canvas.height);
            }
          } catch {
            /* ignore */
          }
        }

        framesRef.current.push({ brightness, motion, faceCenter, faceSize });
        if (framesRef.current.length > 240) framesRef.current.shift();

        const recent = framesRef.current.slice(-30);
        const avgMotion = avg(recent.map((f) => f.motion));
        const avgBrightness = avg(recent.map((f) => f.brightness));
        const brightnessVar = variance(recent.map((f) => f.brightness));

        let engagement = 0.5;
        let composure = 0.5;
        let stress = 0.3;
        let posture = 0.7;

        const facedFrames = recent.filter((f) => f.faceCenter);
        if (facedFrames.length) {
          const faceRatio = facedFrames.length / recent.length;
          const centerOffsets = facedFrames.map(
            (f) => Math.abs((f.faceCenter!.x - 0.5)) + Math.abs(f.faceCenter!.y - 0.5),
          );
          const offsetAvg = avg(centerOffsets);
          engagement = clamp01(faceRatio * (1 - offsetAvg));
          posture = clamp01(1 - offsetAvg * 1.5);
          const sizeAvg = avg(facedFrames.map((f) => f.faceSize ?? 0));
          // Too far back / too close both penalise composure
          composure = clamp01(1 - Math.abs(sizeAvg - 0.12) * 4);
        } else {
          // Fall back to brightness-stability heuristic
          engagement = clamp01(0.4 + (1 - brightnessVar * 8) * 0.4);
          composure = clamp01(1 - brightnessVar * 6);
        }
        // High motion + brightness instability → stress
        stress = clamp01(avgMotion * 0.7 + brightnessVar * 4);

        // very dim → drop engagement
        if (avgBrightness < 0.12) engagement *= 0.5;

        setLive({
          engagement,
          composure,
          posture,
          stress_level: stress,
          frame_count: framesRef.current.length,
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [videoEl, active]);

  function snapshot(): VisualMetrics {
    return { ...live };
  }
  function reset() {
    framesRef.current = [];
    setLive({ engagement: 0.5, composure: 0.5, posture: 0.7, stress_level: 0.3, frame_count: 0 });
  }
  return { live, snapshot, reset };
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function variance(arr: number[]) {
  const m = avg(arr);
  return avg(arr.map((x) => (x - m) ** 2));
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
