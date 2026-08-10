import { useMemo } from "react";

import type { FftSize } from "../types";
import {
  computeScopeScale,
  formatScopeAmplitude,
  formatScopeTime,
  SCOPE_TIME_DIVISIONS,
  SCOPE_VOLTAGE_DIVISIONS,
} from "../utils/scope-scale";

interface StaticWaveformProps {
  timeDomain: Float32Array;
  sampleRate: number;
  fftSize: FftSize;
  height?: number;
}

function buildWaveformPath(
  timeDomain: Float32Array,
  plotLeft: number,
  plotTop: number,
  plotWidth: number,
  plotHeight: number
): string {
  if (timeDomain.length <= 1) return "";

  const midY = plotTop + plotHeight / 2;
  const halfHeight = plotHeight / 2;
  let path = "";

  for (let i = 0; i < timeDomain.length; i++) {
    const x = plotLeft + (i / (timeDomain.length - 1)) * plotWidth;
    const y = midY - (timeDomain[i] ?? 0) * halfHeight;
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  return path;
}

export function StaticWaveform({
  timeDomain,
  sampleRate,
  fftSize,
  height = 240,
}: StaticWaveformProps) {
  const scale = useMemo(
    () => computeScopeScale(sampleRate, fftSize),
    [sampleRate, fftSize]
  );

  const plotLeft = 0;
  const plotWidth = 100;
  const plotTop = 0;
  const plotHeight = 100;

  const tracePath = useMemo(
    () =>
      buildWaveformPath(timeDomain, plotLeft, plotTop, plotWidth, plotHeight),
    [timeDomain]
  );

  return (
    <div className="scope-panel">
      <div className="scope-panel-header">
        <span className="scope-panel-label">Oscilloscope</span>
        <span className="scope-panel-note">Offline snapshot</span>
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
          <svg
            className="static-waveform"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label="Offline waveform snapshot"
          >
            <rect width="100" height="100" className="scope-screen" />
            {Array.from({ length: SCOPE_VOLTAGE_DIVISIONS + 1 }, (_, i) => {
              const y = (i / SCOPE_VOLTAGE_DIVISIONS) * 100;
              const major = i === SCOPE_VOLTAGE_DIVISIONS / 2;
              return (
                <line
                  key={`h-${i}`}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  className={major ? "scope-grid-major" : "scope-grid-minor"}
                />
              );
            })}
            {Array.from({ length: SCOPE_TIME_DIVISIONS + 1 }, (_, i) => {
              const x = (i / SCOPE_TIME_DIVISIONS) * 100;
              const major = i % 5 === 0;
              return (
                <line
                  key={`v-${i}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="100"
                  className={major ? "scope-grid-major" : "scope-grid-minor"}
                />
              );
            })}
            <path d={tracePath} className="trace trace-glow" />
            <path d={tracePath} className="trace trace-core" />
          </svg>
          <div className="scope-readout">
            {formatScopeTime(scale.msPerDiv)}/div ·{" "}
            {formatScopeAmplitude(scale.amplitudePerDiv)}/div
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
  );
}
