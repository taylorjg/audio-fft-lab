import type { PeakFrequency } from '../types'

export function findPeaks(
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
  thresholdDb = -55,
  maxPeaks = 8,
): PeakFrequency[] {
  const binWidth = sampleRate / fftSize
  const peaks: PeakFrequency[] = []

  for (let i = 2; i < frequencyData.length - 2; i++) {
    const value = frequencyData[i]
    if (value === undefined || value < thresholdDb) continue

    const prev = frequencyData[i - 1] ?? -Infinity
    const next = frequencyData[i + 1] ?? -Infinity
    const prev2 = frequencyData[i - 2] ?? -Infinity
    const next2 = frequencyData[i + 2] ?? -Infinity

    if (value > prev && value > next && value > prev2 && value > next2) {
      peaks.push({ frequency: i * binWidth, magnitudeDb: value })
    }
  }

  return peaks
    .sort((a, b) => b.magnitudeDb - a.magnitudeDb)
    .slice(0, maxPeaks)
    .sort((a, b) => a.frequency - b.frequency)
}
