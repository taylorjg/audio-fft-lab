import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { PeakFrequency } from '../types'
import { labelBandHeight, layoutPeakLabels, type PeakMarker } from '../utils/peakLabelLayout'

interface SpectrumAnalyzerProps {
  analyserRef: RefObject<AnalyserNode | null>
  sampleRate: number
  peaks: PeakFrequency[]
  active: boolean
  width?: number
  height?: number
}

const MAX_FREQ = 2000
const MIN_DB = -90
const MAX_DB = 0
const FREQ_TICKS = [0, 500, 1000, 1500, 2000]
const TITLE_BAND = 18
const BOTTOM_PADDING = 32
const PLOT_LEFT = 48
const PLOT_RIGHT_PAD = 16

function buildSpectrumPaths(
  frequencyData: Float32Array,
  sampleRate: number,
  plotLeft: number,
  plotTop: number,
  plotWidth: number,
  plotHeight: number,
): { linePath: string; fillPath: string } {
  const binWidth = sampleRate / (frequencyData.length * 2)
  const barCount = Math.min(frequencyData.length, Math.floor(MAX_FREQ / binWidth))
  if (barCount <= 0) return { linePath: '', fillPath: '' }

  let linePath = ''
  for (let i = 0; i < barCount; i++) {
    const db = frequencyData[i] ?? MIN_DB
    const normalized = Math.max(0, (db - MIN_DB) / (MAX_DB - MIN_DB))
    const barHeight = normalized * plotHeight
    const x = plotLeft + (i / barCount) * plotWidth
    const y = plotTop + plotHeight - barHeight
    linePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
  }

  const baseY = plotTop + plotHeight
  const fillPath = `${linePath} L ${plotLeft + plotWidth} ${baseY} L ${plotLeft} ${baseY} Z`
  return { linePath, fillPath }
}

export function SpectrumAnalyzer({
  analyserRef,
  sampleRate,
  peaks,
  active,
  width = 640,
  height = 220,
}: SpectrumAnalyzerProps) {
  const fillPathRef = useRef<SVGPathElement>(null)
  const linePathRef = useRef<SVGPathElement>(null)
  const rafRef = useRef(0)
  const bufferRef = useRef<Float32Array | null>(null)

  const plotWidth = width - PLOT_LEFT - PLOT_RIGHT_PAD
  const plotRight = width - PLOT_RIGHT_PAD

  const visiblePeaks = useMemo(
    () => peaks.filter((p) => p.frequency <= MAX_FREQ),
    [peaks],
  )

  const labelLanes = useMemo(() => {
    if (visiblePeaks.length === 0) return 0

    const xMarkers: PeakMarker[] = visiblePeaks.map((peak) => ({
      ...peak,
      x: PLOT_LEFT + (peak.frequency / MAX_FREQ) * plotWidth,
      y: 0,
    }))

    const placed = layoutPeakLabels(xMarkers, PLOT_LEFT, plotRight, 100)
    return placed.reduce((max, label) => Math.max(max, label.lane), 0)
  }, [visiblePeaks, plotWidth, plotRight])

  const bandHeight = labelBandHeight(labelLanes, visiblePeaks.length > 0)
  const plotTop = TITLE_BAND + bandHeight + 6
  const plotHeight = height - plotTop - BOTTOM_PADDING
  const plotBottom = plotTop + plotHeight

  const peakMarkers = useMemo((): PeakMarker[] => {
    return visiblePeaks.map((peak) => {
      const x = PLOT_LEFT + (peak.frequency / MAX_FREQ) * plotWidth
      const normalized = Math.max(0, (peak.magnitudeDb - MIN_DB) / (MAX_DB - MIN_DB))
      const y = plotTop + plotHeight - normalized * plotHeight
      return { ...peak, x, y }
    })
  }, [visiblePeaks, plotWidth, plotTop, plotHeight])

  const placedLabels = useMemo(
    () => layoutPeakLabels(peakMarkers, PLOT_LEFT, plotRight, plotTop),
    [peakMarkers, plotRight, plotTop],
  )

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      fillPathRef.current?.setAttribute('d', '')
      linePathRef.current?.setAttribute('d', '')
      return
    }

    const tick = () => {
      const analyser = analyserRef.current
      const fillPathEl = fillPathRef.current
      const linePathEl = linePathRef.current

      if (analyser && fillPathEl && linePathEl) {
        if (!bufferRef.current || bufferRef.current.length !== analyser.frequencyBinCount) {
          bufferRef.current = new Float32Array(analyser.frequencyBinCount)
        }

        analyser.getFloatFrequencyData(bufferRef.current)
        const paths = buildSpectrumPaths(
          bufferRef.current,
          sampleRate,
          PLOT_LEFT,
          plotTop,
          plotWidth,
          plotHeight,
        )
        fillPathEl.setAttribute('d', paths.fillPath)
        linePathEl.setAttribute('d', paths.linePath)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, analyserRef, sampleRate, plotTop, plotWidth, plotHeight])

  const dbLines = [-20, -40, -60, -80]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="spectrum"
      role="img"
      aria-label="FFT spectrum analyzer"
    >
      <rect width={width} height={height} rx="6" className="scope-bezel" />
      <rect
        x={PLOT_LEFT - 8}
        y={plotTop - 8}
        width={plotWidth + 16}
        height={plotHeight + 16}
        rx="4"
        className="scope-screen spectrum-screen"
      />

      {dbLines.map((db) => {
        const y = plotTop + plotHeight - ((db - MIN_DB) / (MAX_DB - MIN_DB)) * plotHeight
        return (
          <g key={db}>
            <line
              x1={PLOT_LEFT}
              y1={y}
              x2={PLOT_LEFT + plotWidth}
              y2={y}
              className="grid-minor"
            />
            <text x={PLOT_LEFT - 6} y={y + 4} className="axis-label" textAnchor="end">
              {db}
            </text>
          </g>
        )
      })}

      {FREQ_TICKS.map((freq) => {
        const x = PLOT_LEFT + (freq / MAX_FREQ) * plotWidth
        return (
          <g key={freq}>
            <line x1={x} y1={plotTop} x2={x} y2={plotBottom} className="grid-minor" />
            <text x={x} y={plotBottom + 12} className="axis-label" textAnchor="middle">
              {freq}
            </text>
          </g>
        )
      })}

      <path ref={fillPathRef} className="spectrum-fill" />
      <path ref={linePathRef} className="spectrum-line" />

      {peakMarkers.map((peak) => (
        <line
          key={peak.frequency}
          x1={peak.x}
          y1={peak.y}
          x2={peak.x}
          y2={plotBottom}
          className="peak-marker"
        />
      ))}

      {placedLabels.map((peak) => (
        <g key={`label-${peak.frequency}`}>
          <line
            x1={peak.labelX}
            y1={peak.labelY + 4}
            x2={peak.x}
            y2={peak.y - 3}
            className="peak-leader"
          />
          <text x={peak.labelX} y={peak.labelY} className="peak-label" textAnchor="middle">
            {Math.round(peak.frequency)} Hz
          </text>
        </g>
      ))}

      <text x={PLOT_LEFT} y={14} className="scope-label">
        FFT
      </text>
      <text x={PLOT_LEFT + plotWidth} y={14} className="scope-readout" textAnchor="end">
        0 – {MAX_FREQ} Hz
      </text>
    </svg>
  )
}
