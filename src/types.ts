export interface SineWaveConfig {
  id: string
  frequency: number
  amplitude: number
  enabled: boolean
}

export interface LabMeta {
  sampleRate: number
  fftSize: number
  peakFrequencies: PeakFrequency[]
}

export interface PeakFrequency {
  frequency: number
  magnitudeDb: number
}

export const FFT_SIZE_OPTIONS = [256, 512, 1024, 2048, 4096, 8192, 16384] as const
export type FftSize = (typeof FFT_SIZE_OPTIONS)[number]
export const DEFAULT_FFT_SIZE: FftSize = 2048

export type ScopeTriggerMode = 'edge' | 'free'
export const DEFAULT_SCOPE_TRIGGER: ScopeTriggerMode = 'edge'

export type FftEngine = 'web-audio' | 'custom'
export const DEFAULT_FFT_ENGINE: FftEngine = 'web-audio'

// Cmaj7 in equal temperament (A4 = 440 Hz): C4, E4, G4, B4
export const DEFAULT_WAVES: SineWaveConfig[] = [
  { id: 'c', frequency: 261.63, amplitude: 0.35, enabled: true },
  { id: 'e', frequency: 329.63, amplitude: 0.3, enabled: true },
  { id: 'g', frequency: 392.0, amplitude: 0.28, enabled: true },
  { id: 'b', frequency: 493.88, amplitude: 0.25, enabled: true },
]
