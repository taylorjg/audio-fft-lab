import type {
  FftEngine,
  FftSize,
  SineWaveConfig,
  SnapshotResult,
} from "../types";
import { findPeaks } from "./find-peaks";
import { readFrequencyFrame } from "./read-frequency-frame";

const RENDER_DURATION_S = 1;

export async function renderSnapshot(
  waves: SineWaveConfig[],
  sampleRate: number,
  fftSize: FftSize,
  fftEngine: FftEngine
): Promise<SnapshotResult> {
  const enabledWaves = waves.filter((wave) => wave.enabled);
  if (enabledWaves.length === 0) {
    throw new Error("Enable at least one sine wave to render a snapshot.");
  }

  const frameCount = Math.ceil(sampleRate * RENDER_DURATION_S);
  const context = new OfflineAudioContext(1, frameCount, sampleRate);
  const mixer = context.createGain();
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;

  for (const wave of enabledWaves) {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = wave.frequency;
    const gain = context.createGain();
    gain.gain.value = wave.amplitude;
    oscillator.connect(gain);
    gain.connect(mixer);
    oscillator.start(0);
    oscillator.stop(RENDER_DURATION_S);
  }

  mixer.connect(analyser);
  analyser.connect(context.destination);

  await context.startRendering();

  const frequencyDomain = new Float32Array(analyser.frequencyBinCount);
  const timeDomain = new Float32Array(analyser.fftSize);
  readFrequencyFrame(analyser, fftEngine, frequencyDomain, timeDomain);

  return {
    sampleRate,
    fftSize,
    timeDomain,
    frequencyDomain,
    peakFrequencies: findPeaks(frequencyDomain, sampleRate, fftSize),
  };
}
