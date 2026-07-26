export const SCOPE_TIME_DIVISIONS = 10
export const SCOPE_VOLTAGE_DIVISIONS = 8

export interface ScopeScale {
  windowMs: number
  msPerDiv: number
  amplitudePerDiv: number
  timeTicks: number[]
  amplitudeTicks: number[]
}

/** Teropa uses analyser.frequencyBinCount (= fftSize / 2) for time-domain samples. */
export function computeScopeScale(sampleRate: number, fftSize: number): ScopeScale {
  const sampleCount = fftSize / 2
  const windowMs = (sampleCount / sampleRate) * 1000
  const msPerDiv = windowMs / SCOPE_TIME_DIVISIONS
  const amplitudeSpan = 2
  const amplitudePerDiv = amplitudeSpan / SCOPE_VOLTAGE_DIVISIONS

  const timeTicks = Array.from({ length: SCOPE_TIME_DIVISIONS + 1 }, (_, i) => i * msPerDiv)
  const amplitudeTicks = Array.from(
    { length: SCOPE_VOLTAGE_DIVISIONS + 1 },
    (_, i) => 1 - i * amplitudePerDiv,
  )

  return { windowMs, msPerDiv, amplitudePerDiv, timeTicks, amplitudeTicks }
}

export function formatScopeTime(ms: number): string {
  if (ms >= 100) return `${Math.round(ms)} ms`
  if (ms >= 10) return `${ms.toFixed(1)} ms`
  if (ms >= 1) return `${ms.toFixed(2)} ms`
  if (ms >= 0.01) return `${(ms * 1000).toFixed(0)} µs`
  return `${(ms * 1000).toFixed(1)} µs`
}

export function formatScopeAmplitude(value: number): string {
  const rounded = Math.abs(value) < 0.001 ? 0 : value
  return rounded.toFixed(2)
}
