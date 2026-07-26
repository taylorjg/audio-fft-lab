import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { Oscilloscope as TeropaScope } from '@teropa/oscilloscope'
import type { FftSize, ScopeTriggerMode } from '../types'
import {
  computeScopeScale,
  formatScopeAmplitude,
  formatScopeTime,
  SCOPE_TIME_DIVISIONS,
  SCOPE_VOLTAGE_DIVISIONS,
} from '../utils/scopeScale'

interface TeropaOscilloscopeProps {
  audioContextRef: RefObject<AudioContext | null>
  audioSourceRef: RefObject<AudioNode | null>
  active: boolean
  fftSize: FftSize
  sampleRate: number
  triggerMode: ScopeTriggerMode
  height?: number
}

function triggerOptions(mode: ScopeTriggerMode) {
  if (mode === 'free') {
    // Byte samples are 0–255; a threshold of 256 is never crossed, so findStart() always returns 0.
    return { edgeThreshold: 256, edgeSlope: 'rising' as const }
  }

  return { edgeThreshold: 128, edgeSlope: 'rising' as const }
}

export function TeropaOscilloscope({
  audioContextRef,
  audioSourceRef,
  active,
  fftSize,
  sampleRate,
  triggerMode,
  height = 240,
}: TeropaOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeLabel = triggerMode === 'edge' ? 'Edge-triggered' : 'Free-running'
  const scale = useMemo(() => computeScopeScale(sampleRate, fftSize), [sampleRate, fftSize])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = audioContextRef.current
    const source = audioSourceRef.current

    if (!active || !canvas || !ctx || !source) return

    const scope = new TeropaScope(canvas, ctx, {
      fftSize,
      ...triggerOptions(triggerMode),
      backgroundColor: '#020804',
      lineColor: '#7fff7f',
      lineWidth: 2,
    })

    scope.connect(source)
    scope.start()

    return () => {
      scope.stop()
      try {
        scope.disconnect(source)
      } catch {
        // masterGain may already be disconnected during audio teardown
      }
    }
  }, [active, audioContextRef, audioSourceRef, fftSize, triggerMode])

  return (
    <div className="scope-panel">
      <div className="scope-panel-header">
        <span className="scope-panel-label">Oscilloscope</span>
        <span className="scope-panel-note">{modeLabel}</span>
      </div>

      <div className="scope-graticule">
        <div className="scope-y-axis" aria-hidden="true">
          {scale.amplitudeTicks.map((value) => (
            <span key={value} className="scope-axis-tick">
              {formatScopeAmplitude(value)}
            </span>
          ))}
        </div>

        <div className="scope-plot-area" style={{ height }}>
          <canvas ref={canvasRef} className="teropa-canvas" />
          <svg className="scope-grid-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
            {Array.from({ length: SCOPE_VOLTAGE_DIVISIONS + 1 }, (_, i) => {
              const y = (i / SCOPE_VOLTAGE_DIVISIONS) * 100
              const major = i === SCOPE_VOLTAGE_DIVISIONS / 2
              return (
                <line
                  key={`h-${i}`}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  className={major ? 'scope-grid-major' : 'scope-grid-minor'}
                />
              )
            })}
            {Array.from({ length: SCOPE_TIME_DIVISIONS + 1 }, (_, i) => {
              const x = (i / SCOPE_TIME_DIVISIONS) * 100
              const major = i % 5 === 0
              return (
                <line
                  key={`v-${i}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="100"
                  className={major ? 'scope-grid-major' : 'scope-grid-minor'}
                />
              )
            })}
          </svg>
          <div className="scope-readout">
            {formatScopeTime(scale.msPerDiv)}/div · {formatScopeAmplitude(scale.amplitudePerDiv)}/div
          </div>
        </div>

        <div className="scope-axis-corner" aria-hidden="true" />

        <div className="scope-x-axis" aria-hidden="true">
          {scale.timeTicks.map((ms) => (
            <span key={ms} className="scope-axis-tick">
              {formatScopeTime(ms)}
            </span>
          ))}
        </div>

        <div className="scope-axis-units scope-y-unit">amplitude</div>
        <div className="scope-axis-units scope-x-unit">time</div>
      </div>
    </div>
  )
}
