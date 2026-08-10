import { renderSnapshot } from "@app/dsp/render-snapshot";
import type {
  FftEngine,
  FftSize,
  SineWaveConfig,
  SnapshotResult,
  SnapshotSampleRate,
} from "@app/types";
import { DEFAULT_SNAPSHOT_SAMPLE_RATE } from "@app/types";
import { useCallback, useEffect, useRef, useState } from "react";

export function useSnapshotLab(
  enabled: boolean,
  waves: SineWaveConfig[],
  fftSize: FftSize,
  fftEngine: FftEngine
) {
  const [sampleRate, setSampleRateState] = useState<SnapshotSampleRate>(
    DEFAULT_SNAPSHOT_SAMPLE_RATE
  );
  const [snapshot, setSnapshot] = useState<SnapshotResult | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const render = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setRendering(true);
    setError(null);

    try {
      const result = await renderSnapshot(
        waves,
        sampleRate,
        fftSize,
        fftEngine
      );
      if (requestId !== requestIdRef.current) return;
      setSnapshot(result);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setSnapshot(null);
      setError(
        caught instanceof Error ? caught.message : "Snapshot render failed."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setRendering(false);
      }
    }
  }, [waves, sampleRate, fftSize, fftEngine]);

  const setSampleRate = useCallback((rate: SnapshotSampleRate) => {
    setSampleRateState(rate);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const timeoutId = window.setTimeout(() => {
      void render();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, render]);

  return {
    sampleRate,
    snapshot: enabled ? snapshot : null,
    rendering: enabled && rendering,
    error: enabled ? error : null,
    render,
    setSampleRate,
  };
}
