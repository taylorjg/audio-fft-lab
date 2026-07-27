import { useState } from 'react'
import { useAudioLab } from './hooks/useAudioLab'
import { TeropaOscilloscope } from './components/TeropaOscilloscope'
import { SpectrumAnalyzer } from './components/SpectrumAnalyzer'
import { APP_VERSION } from './version'
import type { FftEngine, FftSize, PeakFrequency, ScopeTriggerMode, SineWaveConfig } from './types'
import { DEFAULT_SCOPE_TRIGGER, FFT_SIZE_OPTIONS } from './types'

function WaveControl({
  wave,
  onChange,
  onRemove,
  canRemove,
}: {
  wave: SineWaveConfig
  onChange: (patch: Partial<SineWaveConfig>) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className={`wave-control ${wave.enabled ? '' : 'disabled'}`}>
      <label className="wave-toggle">
        <input
          type="checkbox"
          checked={wave.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
        />
        <span>On</span>
      </label>

      <label>
        <span>Frequency</span>
        <input
          type="range"
          min={50}
          max={2000}
          step={1}
          value={wave.frequency}
          onChange={(e) => onChange({ frequency: Number(e.target.value) })}
        />
        <output>{wave.frequency} Hz</output>
      </label>

      <label>
        <span>Amplitude</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={wave.amplitude}
          onChange={(e) => onChange({ amplitude: Number(e.target.value) })}
        />
        <output>{wave.amplitude.toFixed(2)}</output>
      </label>

      {canRemove && (
        <button type="button" className="btn-ghost" onClick={onRemove} aria-label="Remove wave">
          ×
        </button>
      )}
    </div>
  )
}

export default function App() {
  const {
    waves,
    running,
    muted,
    fftSize,
    fftEngine,
    labMeta,
    analyserRef,
    audioContextRef,
    masterGainRef,
    start,
    stop,
    setMuted,
    setFftSize,
    setFftEngine,
    updateWave,
    addWave,
    removeWave,
  } = useAudioLab()

  const [triggerMode, setTriggerMode] = useState<ScopeTriggerMode>(DEFAULT_SCOPE_TRIGGER)

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>
            Audio FFT Lab
            <span className="app-version">v{APP_VERSION}</span>
          </h1>
          <p className="subtitle">
            Synthesise combined sine waves with the Web Audio API, then inspect the time-domain
            signal and frequency spectrum in real time.
          </p>
        </div>
        <div className="transport">
          {!running ? (
            <button type="button" className="btn-primary" onClick={() => void start()}>
              Start
            </button>
          ) : (
            <button type="button" className="btn-danger" onClick={stop}>
              Stop
            </button>
          )}
          <label className="mute-toggle">
            <input
              type="checkbox"
              checked={!muted}
              disabled={!running}
              onChange={(e) => setMuted(!e.target.checked)}
            />
            <span>Monitor audio</span>
          </label>
        </div>
      </header>

      <main className="main">
        <section className="panel displays">
          <TeropaOscilloscope
            audioContextRef={audioContextRef}
            audioSourceRef={masterGainRef}
            active={running}
            fftSize={fftSize}
            sampleRate={labMeta.sampleRate}
            triggerMode={triggerMode}
          />
          <SpectrumAnalyzer
            analyserRef={analyserRef}
            sampleRate={labMeta.sampleRate}
            peaks={labMeta.peakFrequencies}
            active={running}
            fftEngine={fftEngine}
          />

          {labMeta.peakFrequencies.length > 0 && (
            <div className="peak-summary">
              <h3>Detected peaks</h3>
              <ul>
                {labMeta.peakFrequencies.map((peak: PeakFrequency) => (
                  <li key={peak.frequency}>
                    <strong>{Math.round(peak.frequency)} Hz</strong>
                    <span>{peak.magnitudeDb.toFixed(1)} dB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel controls">
          <div className="panel-header">
            <h2>Sine wave generators</h2>
            <button type="button" className="btn-secondary" onClick={addWave}>
              + Add wave
            </button>
          </div>

          <div className="wave-list">
            {waves.map((wave) => (
              <WaveControl
                key={wave.id}
                wave={wave}
                canRemove={waves.length > 1}
                onChange={(patch) => updateWave(wave.id, patch)}
                onRemove={() => removeWave(wave.id)}
              />
            ))}
          </div>

          <div className="analysis-settings">
            <label>
              <span>Scope trigger</span>
              <select
                value={triggerMode}
                onChange={(e) => setTriggerMode(e.target.value as ScopeTriggerMode)}
              >
                <option value="edge">Edge (stable trace)</option>
                <option value="free">Free-running (rolling)</option>
              </select>
            </label>

            <label>
              <span>FFT engine</span>
              <select
                value={fftEngine}
                onChange={(e) => setFftEngine(e.target.value as FftEngine)}
              >
                <option value="web-audio">Web Audio AnalyserNode</option>
                <option value="custom">Custom (radix-2 + Hann)</option>
              </select>
            </label>

            <label>
              <span>FFT size</span>
              <select
                value={fftSize}
                onChange={(e) => setFftSize(Number(e.target.value) as FftSize)}
              >
                {FFT_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <output>
                {(labMeta.sampleRate / labMeta.fftSize).toFixed(2)} Hz/bin
              </output>
            </label>
          </div>

          <div className="meta">
            <span>Sample rate: {labMeta.sampleRate.toLocaleString()} Hz</span>
            <span>FFT size: {labMeta.fftSize}</span>
            <span>Bin width: {(labMeta.sampleRate / labMeta.fftSize).toFixed(2)} Hz</span>
            <span>FFT engine: {fftEngine === 'custom' ? 'Custom' : 'Web Audio'}</span>
            <span>Status: {running ? 'Running' : 'Idle'}</span>
          </div>
        </section>
      </main>
    </div>
  )
}
