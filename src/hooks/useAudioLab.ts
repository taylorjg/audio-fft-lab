import { useCallback, useEffect, useRef, useState } from 'react'
import type { FftSize, LabMeta, PeakFrequency, SineWaveConfig } from '../types'
import { DEFAULT_FFT_SIZE, DEFAULT_WAVES } from '../types'

const SMOOTHING = 0.75
const PEAK_UPDATE_MS = 250

function findPeaks(
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

export function useAudioLab() {
  const [waves, setWaves] = useState<SineWaveConfig[]>(DEFAULT_WAVES)
  const [running, setRunning] = useState(false)
  const [muted, setMuted] = useState(false)
  const [fftSize, setFftSizeState] = useState<FftSize>(DEFAULT_FFT_SIZE)
  const [labMeta, setLabMeta] = useState<LabMeta>({
    sampleRate: 48000,
    fftSize: DEFAULT_FFT_SIZE,
    peakFrequencies: [],
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const oscillatorsRef = useRef<Map<string, { osc: OscillatorNode; gain: GainNode }>>(new Map())
  const rafRef = useRef<number>(0)
  const lastPeakUpdateRef = useRef(0)
  const wavesRef = useRef(waves)
  const fftSizeRef = useRef(fftSize)
  wavesRef.current = waves
  fftSizeRef.current = fftSize

  const stopAnalysisLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  const teardownAudio = useCallback(() => {
    if (!audioContextRef.current && oscillatorsRef.current.size === 0) return

    for (const [, node] of oscillatorsRef.current) {
      node.osc.stop()
      node.osc.disconnect()
      node.gain.disconnect()
    }
    oscillatorsRef.current.clear()

    analyserRef.current?.disconnect()
    masterGainRef.current?.disconnect()
    void audioContextRef.current?.close()

    audioContextRef.current = null
    analyserRef.current = null
    masterGainRef.current = null
  }, [])

  const syncOscillators = useCallback(() => {
    const ctx = audioContextRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return

    const activeIds = new Set<string>()

    for (const wave of wavesRef.current) {
      activeIds.add(wave.id)
      let node = oscillatorsRef.current.get(wave.id)

      if (!node) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(master)
        osc.start()
        node = { osc, gain }
        oscillatorsRef.current.set(wave.id, node)
      }

      node.osc.frequency.setTargetAtTime(wave.frequency, ctx.currentTime, 0.02)
      const targetGain = wave.enabled ? wave.amplitude : 0
      node.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.02)
    }

    for (const [id, node] of oscillatorsRef.current) {
      if (!activeIds.has(id)) {
        node.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
        node.osc.stop(ctx.currentTime + 0.05)
        node.osc.disconnect()
        node.gain.disconnect()
        oscillatorsRef.current.delete(id)
      }
    }
  }, [])

  const startAnalysisLoop = useCallback(() => {
    const analyser = analyserRef.current
    const ctx = audioContextRef.current
    if (!analyser || !ctx) return

    stopAnalysisLoop()
    lastPeakUpdateRef.current = 0

    const frequencyDomain = new Float32Array(analyser.frequencyBinCount)

    const tick = (now: number) => {
      analyser.getFloatFrequencyData(frequencyDomain)

      if (now - lastPeakUpdateRef.current >= PEAK_UPDATE_MS) {
        lastPeakUpdateRef.current = now
        setLabMeta({
          sampleRate: ctx.sampleRate,
          fftSize: analyser.fftSize,
          peakFrequencies: findPeaks(frequencyDomain, ctx.sampleRate, analyser.fftSize),
        })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [stopAnalysisLoop])

  const start = useCallback(async () => {
    if (audioContextRef.current) {
      await audioContextRef.current.resume()
      syncOscillators()
      startAnalysisLoop()
      setRunning(true)
      return
    }

    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = fftSizeRef.current
    analyser.smoothingTimeConstant = SMOOTHING

    const masterGain = ctx.createGain()
    masterGain.gain.value = muted ? 0 : 0.5

    masterGain.connect(analyser)
    analyser.connect(ctx.destination)

    audioContextRef.current = ctx
    analyserRef.current = analyser
    masterGainRef.current = masterGain

    setLabMeta((prev) => ({
      ...prev,
      sampleRate: ctx.sampleRate,
      fftSize: analyser.fftSize,
    }))

    syncOscillators()
    startAnalysisLoop()
    setRunning(true)
  }, [muted, startAnalysisLoop, syncOscillators])

  const stop = useCallback(() => {
    stopAnalysisLoop()
    setRunning(false)
    setLabMeta((prev) => ({ ...prev, peakFrequencies: [] }))
  }, [stopAnalysisLoop])

  const setFftSize = useCallback((size: FftSize) => {
    setFftSizeState(size)
  }, [])

  useEffect(() => {
    if (running) syncOscillators()
  }, [waves, running, syncOscillators])

  useEffect(() => {
    if (!running) {
      setLabMeta((prev) => ({ ...prev, fftSize }))
      return
    }

    const analyser = analyserRef.current
    if (!analyser || analyser.fftSize === fftSize) return

    analyser.fftSize = fftSize
    setLabMeta((prev) => ({ ...prev, fftSize }))
    startAnalysisLoop()
  }, [fftSize, running, startAnalysisLoop])

  useEffect(() => {
    masterGainRef.current?.gain.setTargetAtTime(
      muted ? 0 : 0.5,
      audioContextRef.current?.currentTime ?? 0,
      0.02,
    )
  }, [muted])

  // Let visualiser cleanups disconnect first, then tear down the audio graph.
  useEffect(() => {
    if (running) return
    if (!audioContextRef.current) return

    const frame = requestAnimationFrame(() => {
      teardownAudio()
    })
    return () => cancelAnimationFrame(frame)
  }, [running, teardownAudio])

  useEffect(
    () => () => {
      stopAnalysisLoop()
      teardownAudio()
    },
    [stopAnalysisLoop, teardownAudio],
  )

  const updateWave = useCallback((id: string, patch: Partial<SineWaveConfig>) => {
    setWaves((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }, [])

  const addWave = useCallback(() => {
    setWaves((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        frequency: 330,
        amplitude: 0.2,
        enabled: true,
      },
    ])
  }, [])

  const removeWave = useCallback((id: string) => {
    setWaves((prev) => prev.filter((w) => w.id !== id))
  }, [])

  return {
    waves,
    running,
    muted,
    fftSize,
    labMeta,
    analyserRef,
    audioContextRef,
    masterGainRef,
    start,
    stop,
    setMuted,
    setFftSize,
    updateWave,
    addWave,
    removeWave,
  }
}
