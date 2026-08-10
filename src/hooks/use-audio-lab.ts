import { findPeaks } from "@app/dsp/find-peaks";
import { readFrequencyFrame } from "@app/dsp/read-frequency-frame";
import type {
  FftEngine,
  FftSize,
  InputSource,
  LabMeta,
  SineWaveConfig,
} from "@app/types";
import {
  DEFAULT_FFT_ENGINE,
  DEFAULT_FFT_SIZE,
  DEFAULT_INPUT_SOURCE,
  DEFAULT_WAVES,
} from "@app/types";
import { useCallback, useEffect, useRef, useState } from "react";

const SMOOTHING = 0.75;
const PEAK_UPDATE_MS = 250;
const MONITOR_GAIN = 0.5;

function micPermissionMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone access was denied. Allow mic permission in your browser settings and try again.";
    }
    if (error.name === "NotFoundError") {
      return "No microphone was found on this device.";
    }
  }

  return "Could not access the microphone. Check permissions and try again.";
}

export function useAudioLab() {
  const [waves, setWaves] = useState<SineWaveConfig[]>(DEFAULT_WAVES);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [inputSource, setInputSourceState] =
    useState<InputSource>(DEFAULT_INPUT_SOURCE);
  const [micGain, setMicGainState] = useState(1);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
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
  const synthGainRef = useRef<GainNode | null>(null);
  const mixerGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<
    Map<string, { osc: OscillatorNode; gain: GainNode }>
  >(new Map());
  const rafRef = useRef<number>(0);
  const lastPeakUpdateRef = useRef(0);
  const wavesRef = useRef(waves);
  const fftSizeRef = useRef(fftSize);
  const fftEngineRef = useRef(fftEngine);
  const inputSourceRef = useRef(inputSource);
  const micGainValueRef = useRef(micGain);

  const stopAnalysisLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const releaseMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    micSourceRef.current?.disconnect();
    micSourceRef.current = null;
    micGainRef.current?.disconnect();
    micGainRef.current = null;
    setMicActive(false);
  }, []);

  const teardownAudio = useCallback(() => {
    if (
      !audioContextRef.current &&
      oscillatorsRef.current.size === 0 &&
      !micStreamRef.current
    ) {
      return;
    }

    for (const [, node] of oscillatorsRef.current) {
      node.osc.stop();
      node.osc.disconnect();
      node.gain.disconnect();
    }
    oscillatorsRef.current.clear();

    releaseMic();
    analyserRef.current?.disconnect();
    mixerGainRef.current?.disconnect();
    synthGainRef.current?.disconnect();
    monitorGainRef.current?.disconnect();
    void audioContextRef.current?.close();

    audioContextRef.current = null;
    analyserRef.current = null;
    synthGainRef.current = null;
    mixerGainRef.current = null;
    monitorGainRef.current = null;
  }, [releaseMic]);

  const syncOscillators = useCallback(() => {
    const ctx = audioContextRef.current;
    const synthGain = synthGainRef.current;
    if (!ctx || !synthGain) return;

    const activeIds = new Set<string>();

    for (const wave of wavesRef.current) {
      activeIds.add(wave.id);
      let node = oscillatorsRef.current.get(wave.id);

      if (!node) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(synthGain);
        osc.start();
        node = { osc, gain };
        oscillatorsRef.current.set(wave.id, node);
      }

      node.osc.frequency.setTargetAtTime(wave.frequency, ctx.currentTime, 0.02);
      const synthEnabled = inputSourceRef.current === "synthesizer";
      const targetGain = synthEnabled && wave.enabled ? wave.amplitude : 0;
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

  const syncInputRouting = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const micGainNode = micGainRef.current;
    if (micGainNode) {
      const targetMicGain =
        inputSourceRef.current === "microphone" ? micGainValueRef.current : 0;
      micGainNode.gain.setTargetAtTime(targetMicGain, ctx.currentTime, 0.02);
    }

    if (inputSourceRef.current === "synthesizer") {
      syncOscillators();
      return;
    }

    for (const [, node] of oscillatorsRef.current) {
      node.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    }
  }, [syncOscillators]);

  const ensureMic = useCallback(async (): Promise<boolean> => {
    const ctx = audioContextRef.current;
    const mixerGain = mixerGainRef.current;
    if (!ctx || !mixerGain) return false;

    if (micStreamRef.current && micGainRef.current) {
      setMicActive(true);
      setMicError(null);
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const micSource = ctx.createMediaStreamSource(stream);
      const micGainNode = ctx.createGain();
      micGainNode.gain.value = micGainValueRef.current;

      micSource.connect(micGainNode);
      micGainNode.connect(mixerGain);

      micStreamRef.current = stream;
      micSourceRef.current = micSource;
      micGainRef.current = micGainNode;
      setMicActive(true);
      setMicError(null);
      return true;
    } catch (error) {
      setMicError(micPermissionMessage(error));
      setMicActive(false);
      return false;
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

  const createAudioGraph = useCallback(() => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSizeRef.current;
    analyser.smoothingTimeConstant = SMOOTHING;

    const synthGain = ctx.createGain();
    const mixerGain = ctx.createGain();
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = muted ? 0 : MONITOR_GAIN;

    synthGain.connect(mixerGain);
    mixerGain.connect(analyser);
    analyser.connect(monitorGain);
    monitorGain.connect(ctx.destination);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    synthGainRef.current = synthGain;
    mixerGainRef.current = mixerGain;
    monitorGainRef.current = monitorGain;

    setLabMeta((prev) => ({
      ...prev,
      sampleRate: ctx.sampleRate,
      fftSize: analyser.fftSize,
    }));

    return ctx;
  }, [muted]);

  const start = useCallback(async () => {
    if (!audioContextRef.current) {
      createAudioGraph();
    } else {
      await audioContextRef.current.resume();
    }

    if (inputSourceRef.current === "microphone") {
      const micReady = await ensureMic();
      if (!micReady) {
        teardownAudio();
        return;
      }
    }

    syncInputRouting();
    startAnalysisLoop();
    setRunning(true);
  }, [
    createAudioGraph,
    ensureMic,
    startAnalysisLoop,
    syncInputRouting,
    teardownAudio,
  ]);

  const stop = useCallback(() => {
    stopAnalysisLoop();
    setRunning(false);
    setLabMeta((prev) => ({ ...prev, peakFrequencies: [] }));
  }, [stopAnalysisLoop]);

  const setInputSource = useCallback(
    async (source: InputSource) => {
      setInputSourceState(source);
      inputSourceRef.current = source;
      setMicError(null);

      if (!running) return;

      if (source === "microphone") {
        const micReady = await ensureMic();
        if (!micReady) {
          setInputSourceState("synthesizer");
          inputSourceRef.current = "synthesizer";
          syncInputRouting();
          return;
        }
      } else {
        releaseMic();
      }

      syncInputRouting();
    },
    [ensureMic, releaseMic, running, syncInputRouting]
  );

  const setMicGain = useCallback((gain: number) => {
    setMicGainState(gain);
    micGainValueRef.current = gain;
    const ctx = audioContextRef.current;
    if (ctx && micGainRef.current && inputSourceRef.current === "microphone") {
      micGainRef.current.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
    }
  }, []);

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
    if (running && inputSourceRef.current === "synthesizer") {
      syncOscillators();
    }
  }, [waves, running, syncOscillators]);

  useEffect(() => {
    monitorGainRef.current?.gain.setTargetAtTime(
      muted ? 0 : MONITOR_GAIN,
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
    inputSource,
    micGain,
    micActive,
    micError,
    fftSize,
    fftEngine,
    labMeta,
    analyserRef,
    audioContextRef,
    signalSourceRef: mixerGainRef,
    start,
    stop,
    setMuted,
    setInputSource,
    setMicGain,
    setFftSize,
    setFftEngine,
    updateWave,
    addWave,
    removeWave,
  };
}
