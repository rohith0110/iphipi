"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export interface DeepgramStreamState {
  ready: boolean;
  recording: boolean;
  interim: string;
  final: string;
  durationSec: number;
  wordConfidences: number[];
}

export function useDeepgramStream() {
  const [state, setState] = useState<DeepgramStreamState>({
    ready: false,
    recording: false,
    interim: "",
    final: "",
    durationSec: 0,
    wordConfidences: [],
  });

  const connRef = useRef<ReturnType<
    ReturnType<typeof createClient>["listen"]["live"]
  > | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startTsRef = useRef(0);

  const start = useCallback(async (audioStream: MediaStream) => {
    setState((s) => ({ ...s, interim: "", final: "", durationSec: 0, wordConfidences: [] }));

    const tokenRes = await fetch("/api/deepgram/token");
    const { key, error } = await tokenRes.json();
    if (!key) throw new Error(error || "no deepgram key");

    const dg = createClient(key);
    const conn = dg.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      interim_results: true,
      filler_words: true,
      punctuate: true,
      encoding: "opus",
      sample_rate: 48000,
    });
    connRef.current = conn;

    conn.on(LiveTranscriptionEvents.Open, () => {
      setState((s) => ({ ...s, ready: true, recording: true }));
      startTsRef.current = Date.now();

      const rec = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 64000,
      });
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && conn.getReadyState() === 1) {
          conn.send(e.data);
        }
      };
      rec.start(250);
    });

    conn.on(LiveTranscriptionEvents.Transcript, (msg) => {
      const alt = msg.channel?.alternatives?.[0];
      if (!alt) return;
      const text = alt.transcript ?? "";
      if (!text) return;
      if (msg.is_final) {
        setState((s) => ({
          ...s,
          final: (s.final + " " + text).trim(),
          interim: "",
          wordConfidences: [
            ...s.wordConfidences,
            ...((alt.words || []).map((w: { confidence?: number }) => w.confidence ?? 0.85)),
          ],
          durationSec: (Date.now() - startTsRef.current) / 1000,
        }));
      } else {
        setState((s) => ({ ...s, interim: text }));
      }
    });

    conn.on(LiveTranscriptionEvents.Error, (err) => {
      console.error("[deepgram]", err);
    });
  }, []);

  const stop = useCallback(async () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    try {
      connRef.current?.requestClose?.();
    } catch {
      /* ignore */
    }
    connRef.current = null;
    setState((s) => ({
      ...s,
      recording: false,
      durationSec: (Date.now() - startTsRef.current) / 1000,
    }));
  }, []);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
        connRef.current?.requestClose?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { state, start, stop };
}
