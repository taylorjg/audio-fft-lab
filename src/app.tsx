import { useState } from "react";

import { SpectrumAnalyzer } from "./components/spectrum-analyzer";
import { StaticWaveform } from "./components/static-waveform";
import { TeropaOscilloscope } from "./components/teropa-oscilloscope";
import { useAudioLab } from "./hooks/use-audio-lab";
import { useSnapshotLab } from "./hooks/use-snapshot-lab";
import type {
  FftEngine,
  FftSize,
  InputSource,
  LabMode,
  PeakFrequency,
  ScopeTriggerMode,
  SineWaveConfig,
  SnapshotSampleRate,
} from "./types";
import {
  DEFAULT_LAB_MODE,
  DEFAULT_SCOPE_TRIGGER,
  FFT_SIZE_OPTIONS,
  INPUT_SOURCE_LABELS,
  LAB_MODE_LABELS,
  SNAPSHOT_SAMPLE_RATES,
} from "./types";
import { APP_VERSION } from "./version";

function WaveControl({
  wave,
  onChange,
  onRemove,
  canRemove,
}: {
  wave: SineWaveConfig;
  onChange: (patch: Partial<SineWaveConfig>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className={`wave-control ${wave.enabled ? "" : "disabled"}`}>
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
        <button
          type="button"
          className="btn-ghost"
          onClick={onRemove}
          aria-label="Remove wave"
        >
          ×
        </button>
      )}
    </div>
  );
}

const INPUT_SOURCES: InputSource[] = ["synthesizer", "microphone"];
const LAB_MODES: LabMode[] = ["live", "snapshot"];

export default function App() {
  const [labMode, setLabMode] = useState<LabMode>(DEFAULT_LAB_MODE);
  const [triggerMode, setTriggerMode] = useState<ScopeTriggerMode>(
    DEFAULT_SCOPE_TRIGGER
  );

  const {
    waves,
    running,
    muted,
    inputSource,
    micGain,
    micActive,
    micError,
    fftSize,
    fftEngine,
    labMeta,
    analyserRef,
    audioContextRef,
    signalSourceRef,
    start,
    stop,
    setMuted,
    setInputSource,
    setMicGain,
    setFftSize,
    setFftEngine,
    updateWave,
    addWave,
    removeWave,
  } = useAudioLab();

  const isSnapshotMode = labMode === "snapshot";
  const {
    sampleRate: snapshotSampleRate,
    snapshot,
    rendering,
    error: snapshotError,
    render: renderSnapshot,
    setSampleRate: setSnapshotSampleRate,
  } = useSnapshotLab(isSnapshotMode, waves, fftSize, fftEngine);

  const displaySampleRate = isSnapshotMode
    ? (snapshot?.sampleRate ?? snapshotSampleRate)
    : labMeta.sampleRate;
  const displayPeaks = isSnapshotMode
    ? (snapshot?.peakFrequencies ?? [])
    : labMeta.peakFrequencies;

  const onLabModeChange = (mode: LabMode) => {
    if (mode === "snapshot" && running) stop();
    if (mode === "snapshot" && inputSource === "microphone") {
      void setInputSource("synthesizer");
    }
    setLabMode(mode);
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>
            Audio FFT Lab
            <span className="app-version">v{APP_VERSION}</span>
          </h1>
          <p className="subtitle">
            Analyse sine-wave synthesis live or render an offline snapshot at a
            chosen sample rate. Inspect the waveform and frequency spectrum with
            the Web Audio API.
          </p>
        </div>
        <div className="transport">
          {isSnapshotMode ? (
            <button
              type="button"
              className="btn-primary"
              disabled={rendering}
              onClick={() => void renderSnapshot()}
            >
              {rendering ? "Rendering…" : "Render snapshot"}
            </button>
          ) : !running ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void start()}
            >
              Start
            </button>
          ) : (
            <button type="button" className="btn-danger" onClick={stop}>
              Stop
            </button>
          )}
          {!isSnapshotMode && (
            <label className="mute-toggle">
              <input
                type="checkbox"
                checked={!muted}
                disabled={!running}
                onChange={(e) => setMuted(!e.target.checked)}
              />
              <span>Monitor audio</span>
            </label>
          )}
        </div>
      </header>

      <main className="main">
        <section className="panel displays">
          {isSnapshotMode ? (
            snapshot ? (
              <>
                <StaticWaveform
                  timeDomain={snapshot.timeDomain}
                  sampleRate={snapshot.sampleRate}
                  fftSize={snapshot.fftSize}
                />
                <SpectrumAnalyzer
                  frequencyData={snapshot.frequencyDomain}
                  sampleRate={snapshot.sampleRate}
                  peaks={snapshot.peakFrequencies}
                  active={false}
                  fftEngine={fftEngine}
                />
              </>
            ) : (
              <p className="display-placeholder" role="status">
                {rendering
                  ? "Rendering offline snapshot…"
                  : (snapshotError ??
                    "Adjust synthesizer settings and render a snapshot.")}
              </p>
            )
          ) : (
            <>
              <TeropaOscilloscope
                audioContextRef={audioContextRef}
                audioSourceRef={signalSourceRef}
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
            </>
          )}

          {displayPeaks.length > 0 && (
            <div className="peak-summary">
              <h3>Detected peaks</h3>
              <ul>
                {displayPeaks.map((peak: PeakFrequency) => (
                  <li key={peak.frequency}>
                    <strong>{Math.round(peak.frequency)} Hz</strong>
                    <span>{peak.magnitudeDb.toFixed(1)} dB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="controls-grid">
          <section className="panel mode-panel">
            <h2>Analysis mode</h2>
            <fieldset className="source-selector">
              <legend className="visually-hidden">Choose analysis mode</legend>
              {LAB_MODES.map((mode) => (
                <label key={mode} className="source-option">
                  <input
                    type="radio"
                    name="lab-mode"
                    value={mode}
                    checked={labMode === mode}
                    onChange={() => onLabModeChange(mode)}
                  />
                  <span>{LAB_MODE_LABELS[mode]}</span>
                </label>
              ))}
            </fieldset>
            {isSnapshotMode ? (
              <p className="source-note">
                Renders one second of mixed sine waves with{" "}
                <code>OfflineAudioContext</code>, then reads a single analyser
                frame — like the old Shazizzle oscillator experiment, with a
                selectable sample rate to explore bin width.
              </p>
            ) : (
              <p className="source-note">
                Real-time capture from the synthesizer or microphone while the
                lab is running.
              </p>
            )}
          </section>

          <section className="panel source-panel">
            <h2>Input source</h2>
            <fieldset className="source-selector">
              <legend className="visually-hidden">Choose input source</legend>
              {INPUT_SOURCES.map((source) => (
                <label
                  key={source}
                  className={`source-option ${isSnapshotMode && source === "microphone" ? "disabled" : ""}`}
                >
                  <input
                    type="radio"
                    name="input-source"
                    value={source}
                    checked={inputSource === source}
                    disabled={isSnapshotMode && source === "microphone"}
                    onChange={() => void setInputSource(source)}
                  />
                  <span>{INPUT_SOURCE_LABELS[source]}</span>
                </label>
              ))}
            </fieldset>

            {!isSnapshotMode && inputSource === "microphone" && (
              <div className="mic-controls">
                <p className="mic-note">
                  Click <strong>Start</strong> to request microphone access. Use
                  headphones when monitoring live input to avoid feedback.
                </p>

                <label>
                  <span>Input gain</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.01}
                    value={micGain}
                    disabled={!running}
                    onChange={(e) => setMicGain(Number(e.target.value))}
                  />
                  <output>{micGain.toFixed(2)}</output>
                </label>

                <p
                  className={`mic-status ${micError ? "mic-status-error" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  {micError ??
                    (running && micActive
                      ? "Microphone connected."
                      : running
                        ? "Waiting for microphone…"
                        : "Idle — start to capture live audio.")}
                </p>
              </div>
            )}

            {!isSnapshotMode && inputSource === "synthesizer" && (
              <p className="source-note">
                Mix one or more sine waves below. Peak detection should align
                with the frequencies you enable.
              </p>
            )}

            {isSnapshotMode && (
              <p className="source-note">
                Snapshot mode uses the synthesizer mix only. Configure waves
                below, then render.
              </p>
            )}
          </section>

          {(inputSource === "synthesizer" || isSnapshotMode) && (
            <section className="panel synth-panel">
              <div className="panel-header">
                <h2>Sine wave generators</h2>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addWave}
                >
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
            </section>
          )}

          <section className="panel analysis-panel">
            <h2>Analysis</h2>

            <div className="analysis-settings">
              {!isSnapshotMode && (
                <label>
                  <span>Scope trigger</span>
                  <select
                    value={triggerMode}
                    onChange={(e) =>
                      setTriggerMode(e.target.value as ScopeTriggerMode)
                    }
                  >
                    <option value="edge">Edge (stable trace)</option>
                    <option value="free">Free-running (rolling)</option>
                  </select>
                </label>
              )}

              {isSnapshotMode && (
                <label>
                  <span>Sample rate</span>
                  <select
                    value={snapshotSampleRate}
                    onChange={(e) =>
                      setSnapshotSampleRate(
                        Number(e.target.value) as SnapshotSampleRate
                      )
                    }
                  >
                    {SNAPSHOT_SAMPLE_RATES.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate.toLocaleString()} Hz
                      </option>
                    ))}
                  </select>
                  <output>
                    {(snapshotSampleRate / fftSize).toFixed(2)} Hz/bin
                  </output>
                </label>
              )}

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
                  onChange={(e) =>
                    setFftSize(Number(e.target.value) as FftSize)
                  }
                >
                  {FFT_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <output>
                  {(displaySampleRate / fftSize).toFixed(2)} Hz/bin
                </output>
              </label>
            </div>

            <div className="meta">
              <span>Mode: {LAB_MODE_LABELS[labMode]}</span>
              {!isSnapshotMode && (
                <span>Input: {INPUT_SOURCE_LABELS[inputSource]}</span>
              )}
              <span>Sample rate: {displaySampleRate.toLocaleString()} Hz</span>
              <span>FFT size: {fftSize}</span>
              <span>
                Bin width: {(displaySampleRate / fftSize).toFixed(2)} Hz
              </span>
              <span>
                FFT engine: {fftEngine === "custom" ? "Custom" : "Web Audio"}
              </span>
              <span>
                Status:{" "}
                {isSnapshotMode
                  ? rendering
                    ? "Rendering"
                    : snapshot
                      ? "Snapshot ready"
                      : "Idle"
                  : running
                    ? "Running"
                    : "Idle"}
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
