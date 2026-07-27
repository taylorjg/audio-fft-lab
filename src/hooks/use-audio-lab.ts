import { useCallback, useEffect, useRef, useState } from "react";

import { findPeaks } from "../dsp/find-peaks";
import { readFrequencyFrame } from "../dsp/read-frequency-frame";
import type { FftEngine, FftSize, LabMeta, SineWaveConfig } from "../types";
import { DEFAULT_FFT_ENGINE, DEFAULT_FFT_SIZE, DEFAULT_WAVES } from "../types";

const SMOOTHING = 0.75;
const PEAK_UPDATE_MS = 250;

export function useAudioLab() {
  const [waves, setWaves] = useState<SineWaveConfig[]>(DEFAULT_WAVES);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fftSize, setFftSizeState] = useState<FftSize>(DEFAULT_FFT_SIZE);
  const [fftEngine, setFftEngineState] =
    useState<FftEngine>(DEFAULT_FFT_ENGINE);
  const [labMeta, setLabMeta] = useState<LabMeta>({
    sampleRate: 48000,
    fftSize: DEFAULT_FFT_SIZE,
    peakFrequencies: [],
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<
    Map<string, { osc: OscillatorNode; gain: GainNode }>
  >(new Map());
  const rafRef = useRef<number>(0);
  const lastPeakUpdateRef = useRef(0);
  const wavesRef = useRef(waves);
  const fftSizeRef = useRef(fftSize);
  const fftEngineRef = useRef(fftEngine);

  const stopAnalysisLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const teardownAudio = useCallback(() => {
    if (!audioContextRef.current && oscillatorsRef.current.size === 0) return;

    for (const [, node] of oscillatorsRef.current) {
      node.osc.stop();
      node.osc.disconnect();
      node.gain.disconnect();
    }
    oscillatorsRef.current.clear();

    analyserRef.current?.disconnect();
    masterGainRef.current?.disconnect();
    void audioContextRef.current?.close();

    audioContextRef.current = null;
    analyserRef.current = null;
    masterGainRef.current = null;
  }, []);

  const syncOscillators = useCallback(() => {
    const ctx = audioContextRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const activeIds = new Set<string>();

    for (const wave of wavesRef.current) {
      activeIds.add(wave.id);
      let node = oscillatorsRef.current.get(wave.id);

      if (!node) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        node = { osc, gain };
        oscillatorsRef.current.set(wave.id, node);
      }

      node.osc.frequency.setTargetAtTime(wave.frequency, ctx.currentTime, 0.02);
      const targetGain = wave.enabled ? wave.amplitude : 0;
      node.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.02);
    }

    for (const [id, node] of oscillatorsRef.current) {
      if (!activeIds.has(id)) {
        node.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        node.osc.stop(ctx.currentTime + 0.05);
        node.osc.disconnect();
        node.gain.disconnect();
        oscillatorsRef.current.delete(id);
      }
    }
  }, []);

  const startAnalysisLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioContextRef.current;
    if (!analyser || !ctx) return;

    stopAnalysisLoop();
    lastPeakUpdateRef.current = 0;

    const frequencyDomain = new Float32Array(analyser.frequencyBinCount);
    const timeDomain = new Float32Array(analyser.fftSize);

    const tick = (now: number) => {
      readFrequencyFrame(
        analyser,
        fftEngineRef.current,
        frequencyDomain,
        timeDomain
      );

      if (now - lastPeakUpdateRef.current >= PEAK_UPDATE_MS) {
        lastPeakUpdateRef.current = now;
        setLabMeta({
          sampleRate: ctx.sampleRate,
          fftSize: analyser.fftSize,
          peakFrequencies: findPeaks(
            frequencyDomain,
            ctx.sampleRate,
            analyser.fftSize
          ),
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopAnalysisLoop]);

  const start = useCallback(async () => {
    if (audioContextRef.current) {
      await audioContextRef.current.resume();
      syncOscillators();
      startAnalysisLoop();
      setRunning(true);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSizeRef.current;
    analyser.smoothingTimeConstant = SMOOTHING;

    const masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;

    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    masterGainRef.current = masterGain;

    setLabMeta((prev) => ({
      ...prev,
      sampleRate: ctx.sampleRate,
      fftSize: analyser.fftSize,
    }));

    syncOscillators();
    startAnalysisLoop();
    setRunning(true);
  }, [muted, startAnalysisLoop, syncOscillators]);

  const stop = useCallback(() => {
    stopAnalysisLoop();
    setRunning(false);
    setLabMeta((prev) => ({ ...prev, peakFrequencies: [] }));
  }, [stopAnalysisLoop]);

  const setFftSize = useCallback(
    (size: FftSize) => {
      setFftSizeState(size);
      fftSizeRef.current = size;

      const analyser = analyserRef.current;
      if (running && analyser) {
        analyser.fftSize = size;
        startAnalysisLoop();
      }
    },
    [running, startAnalysisLoop]
  );

  const setFftEngine = useCallback(
    (engine: FftEngine) => {
      setFftEngineState(engine);
      fftEngineRef.current = engine;
      if (running) startAnalysisLoop();
    },
    [running, startAnalysisLoop]
  );

  useEffect(() => {
    wavesRef.current = waves;
    if (running) syncOscillators();
  }, [waves, running, syncOscillators]);

  useEffect(() => {
    masterGainRef.current?.gain.setTargetAtTime(
      muted ? 0 : 0.5,
      audioContextRef.current?.currentTime ?? 0,
      0.02
    );
  }, [muted]);

  // Let visualiser cleanups disconnect first, then tear down the audio graph.
  useEffect(() => {
    if (running) return;
    if (!audioContextRef.current) return;

    const frame = requestAnimationFrame(() => {
      teardownAudio();
    });
    return () => cancelAnimationFrame(frame);
  }, [running, teardownAudio]);

  useEffect(
    () => () => {
      stopAnalysisLoop();
      teardownAudio();
    },
    [stopAnalysisLoop, teardownAudio]
  );

  const updateWave = useCallback(
    (id: string, patch: Partial<SineWaveConfig>) => {
      setWaves((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
      );
    },
    []
  );

  const addWave = useCallback(() => {
    setWaves((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        frequency: 330,
        amplitude: 0.2,
        enabled: true,
      },
    ]);
  }, []);

  const removeWave = useCallback((id: string) => {
    setWaves((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return {
    waves,
    running,
    muted,
    fftSize,
    fftEngine,
    labMeta,
    analyserRef,
    audioContextRef,
    masterGainRef,
    start,
    stop,
    setMuted,
    setFftSize,
    setFftEngine,
    updateWave,
    addWave,
    removeWave,
  };
}
