import { getFftPlan } from "@app/dsp/fft-plan";

export function hannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  if (size === 1) {
    window[0] = 1;
    return window;
  }

  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

const windowCache = new Map<number, Float64Array>();

function getHannWindow(size: number): Float64Array {
  let window = windowCache.get(size);
  if (!window) {
    window = hannWindow(size);
    windowCache.set(size, window);
  }
  return window;
}

/** Convert linear magnitude to decibels, clamped for display. */
export function linearToDb(magnitude: number, floorDb = -90): number {
  const safe = Math.max(magnitude, 1e-12);
  return Math.max(floorDb, 20 * Math.log10(safe));
}

/**
 * Compute one-sided magnitude spectrum (dB) from a time-domain frame.
 * Uses a Hann window and radix-2 FFT — intended as a warm-up for music-id work.
 */
export function computeMagnitudeSpectrumDb(
  timeDomain: Float32Array,
  output: Float32Array
): void {
  const size = timeDomain.length;
  const plan = getFftPlan(size);
  const window = getHannWindow(size);
  const real = new Float64Array(size);
  const imag = new Float64Array(size);
  const frame = new Float32Array(size);

  for (let i = 0; i < size; i++) {
    frame[i] = (timeDomain[i] ?? 0) * (window[i] ?? 1);
  }

  plan.forward(frame, real, imag);

  const binCount = size >> 1;
  const norm = size / 2;

  for (let bin = 0; bin < binCount; bin++) {
    const re = real[bin] ?? 0;
    const im = imag[bin] ?? 0;
    // Hann coherent-gain compensation (x2) keeps a unity sine near 0 dB.
    const magnitude = (Math.hypot(re, im) / norm) * 2;
    output[bin] = linearToDb(magnitude);
  }
}
