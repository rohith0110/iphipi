"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface DeepgramStreamState {
  ready: boolean;
  recording: boolean;
  interim: string;
  final: string;
  durationSec: number;
  wordConfidences: number[];
  error: string | null;
}

export interface DeepgramStopResult {
  final: string;
  wordConfidences: number[];
  durationSec: number;
}

export interface DeepgramStartOptions {
  /**
   * Tokens to boost during recognition — typically the candidate's tech stack
   * extracted from their resume. Without this, default English STT mangles
   * "Convex", "PostHog", "Next.js", "Clerk", etc. into homophones.
   */
  keyterms?: string[];
}

interface DGWord {
  word?: string;
  confidence?: number;
}

interface DGResultsMessage {
  type: "Results";
  is_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      words?: DGWord[];
    }>;
  };
}

interface DGOtherMessage {
  type: string;
}

type DGMessage = DGResultsMessage | DGOtherMessage;

const DRAIN_TIMEOUT_MS = 2500;

export function useDeepgramStream() {
  const [state, setState] = useState<DeepgramStreamState>({
    ready: false,
    recording: false,
    interim: "",
    final: "",
    durationSec: 0,
    wordConfidences: [],
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startTsRef = useRef(0);
  // Source-of-truth refs — written synchronously inside ws.onmessage, read by
  // stop() on submit so we never miss the trailing words that arrive after
  // React state has already been read by the caller.
  const finalRef = useRef("");
  const wordConfsRef = useRef<number[]>([]);

  const start = useCallback(
    async (audioStream: MediaStream, opts?: DeepgramStartOptions) => {
      finalRef.current = "";
      wordConfsRef.current = [];
      setState({
        ready: false,
        recording: false,
        interim: "",
        final: "",
        durationSec: 0,
        wordConfidences: [],
        error: null,
      });

      let key: string | undefined;
      try {
        const tokenRes = await fetch("/api/deepgram/token");
        const body = (await tokenRes.json()) as {
          key?: string;
          error?: string;
        };
        key = body.key;
        if (!key) throw new Error(body.error || "no deepgram key");
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : "token error",
        }));
        return;
      }

      // nova-3 is more accurate on technical jargon than nova-2 and supports
      // multi-word `keyterm` boosting (rather than nova-2's single-token
      // `keywords`). Each repetition of the keyterm param adds a phrase.
      const params = new URLSearchParams({
        model: "nova-3",
        language: "en-US",
        smart_format: "true",
        interim_results: "true",
        filler_words: "true",
        punctuate: "true",
        numerals: "true",
      });

      const seen = new Set<string>();
      for (const raw of opts?.keyterms ?? []) {
        const term = (raw ?? "").trim();
        if (!term || term.length < 2 || term.length > 64) continue;
        const norm = term.toLowerCase();
        if (seen.has(norm)) continue;
        seen.add(norm);
        params.append("keyterm", term);
        if (seen.size >= 50) break; // server has practical caps; stay under
      }

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ["token", key],
      );
      wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, ready: true, recording: true, error: null }));
      startTsRef.current = Date.now();

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime
        ? new MediaRecorder(audioStream, {
            mimeType: mime,
            audioBitsPerSecond: 64000,
          })
        : new MediaRecorder(audioStream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };
      rec.start(250);
    };

    ws.onmessage = (event) => {
      let msg: DGMessage;
      try {
        msg = JSON.parse(event.data as string) as DGMessage;
      } catch {
        return;
      }
      if (msg.type !== "Results") return;
      const results = msg as DGResultsMessage;
      const alt = results.channel?.alternatives?.[0];
      if (!alt) return;
      const text = alt.transcript ?? "";
      if (!text) return;
      if (results.is_final) {
        finalRef.current = (finalRef.current + " " + text).trim();
        wordConfsRef.current = [
          ...wordConfsRef.current,
          ...(alt.words ?? []).map((w) => w.confidence ?? 0.85),
        ];
        setState((s) => ({
          ...s,
          final: finalRef.current,
          interim: "",
          wordConfidences: wordConfsRef.current,
          durationSec: (Date.now() - startTsRef.current) / 1000,
        }));
      } else {
        setState((s) => ({
          ...s,
          interim: text,
          durationSec: (Date.now() - startTsRef.current) / 1000,
        }));
      }
    };

    ws.onerror = () => {
      setState((s) => ({
        ...s,
        error: "Live transcription connection error",
      }));
    };

    ws.onclose = (ev) => {
      if (ev.code !== 1000 && ev.code !== 1005) {
        setState((s) => ({
          ...s,
          error: s.error ?? `Transcription closed (${ev.code})`,
        }));
      }
      setState((s) => ({ ...s, recording: false }));
    };
  }, []);

  const stop = useCallback(async (): Promise<DeepgramStopResult> => {
    // 1) Stop emitting new audio so Deepgram's buffer stops growing.
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;

    const ws = wsRef.current;
    if (!ws) {
      const dur = (Date.now() - startTsRef.current) / 1000;
      setState((s) => ({ ...s, recording: false, durationSec: dur }));
      return {
        final: finalRef.current,
        wordConfidences: wordConfsRef.current,
        durationSec: dur,
      };
    }

    // 2) Tell Deepgram to flush remaining audio + return any pending Results,
    //    then close. We wait for the close event so the trailing is_final
    //    messages have a chance to land in onmessage before we resolve.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          ws.close(1000);
        } catch {
          /* ignore */
        }
        resolve();
      }, DRAIN_TIMEOUT_MS);

      const prevOnClose = ws.onclose;
      ws.onclose = (ev) => {
        clearTimeout(timer);
        if (typeof prevOnClose === "function") prevOnClose.call(ws, ev);
        resolve();
      };

      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "CloseStream" }));
        } else {
          clearTimeout(timer);
          resolve();
        }
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });

    wsRef.current = null;

    const dur = (Date.now() - startTsRef.current) / 1000;
    setState((s) => ({ ...s, recording: false, durationSec: dur }));
    return {
      final: finalRef.current,
      wordConfidences: wordConfsRef.current,
      durationSec: dur,
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { state, start, stop };
}
