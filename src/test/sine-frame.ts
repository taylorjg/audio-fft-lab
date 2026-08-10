/** Build one cycle-aligned sine frame for FFT tests. */
export function makeSineFrame(
  frequency: number,
  sampleRate: number,
  length: number,
  amplitude = 1
): Float32Array {
  const frame = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    frame[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return frame;
}

export function peakBinIndex(spectrum: Float32Array): number {
  let best = 0;
  for (let i = 1; i < spectrum.length; i++) {
    if ((spectrum[i] ?? -Infinity) > (spectrum[best] ?? -Infinity)) {
      best = i;
    }
  }
  return best;
}
