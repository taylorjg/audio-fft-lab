import type { PeakFrequency } from '../types'

export interface PeakMarker extends PeakFrequency {
  x: number
  y: number
}

export interface PlacedPeakLabel extends PeakMarker {
  labelX: number
  labelY: number
  lane: number
}

const LABEL_CHAR_WIDTH = 5.5
const LABEL_PADDING = 6
const LABEL_LANE_HEIGHT = 13

export function estimateLabelWidth(text: string): number {
  return text.length * LABEL_CHAR_WIDTH + LABEL_PADDING
}

export function labelBandHeight(labelLanes: number, hasPeaks: boolean): number {
  if (!hasPeaks) return 0
  return 8 + labelLanes * LABEL_LANE_HEIGHT
}

export function layoutPeakLabels(
  markers: PeakMarker[],
  plotLeft: number,
  plotRight: number,
  plotTop: number,
): PlacedPeakLabel[] {
  const sorted = [...markers].sort((a, b) => a.x - b.x)
  const laneEnds: number[] = []
  const placed: PlacedPeakLabel[] = []

  for (const marker of sorted) {
    const text = `${Math.round(marker.frequency)} Hz`
    const halfWidth = estimateLabelWidth(text) / 2
    let lane = 0

    while (true) {
      const minX = plotLeft + halfWidth
      const maxX = plotRight - halfWidth
      const labelX = Math.min(maxX, Math.max(minX, marker.x))
      const left = labelX - halfWidth
      const right = labelX + halfWidth
      const lastRight = laneEnds[lane] ?? -Infinity

      if (left >= lastRight + 4) {
        laneEnds[lane] = right
        placed.push({
          ...marker,
          labelX,
          labelY: plotTop - 6 - lane * LABEL_LANE_HEIGHT,
          lane,
        })
        break
      }

      lane += 1
      if (lane > 8) {
        placed.push({
          ...marker,
          labelX: marker.x,
          labelY: plotTop - 6,
          lane: 0,
        })
        break
      }
    }
  }

  return placed
}
