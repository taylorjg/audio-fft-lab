# Audio FFT Lab

A small React/TypeScript experiment for exploring sine-wave synthesis, live microphone capture, offline snapshot rendering, and real-time spectral analysis using the Web Audio API.

## What it does

- **Synthesises** one or more sine waves via `OscillatorNode`, mixed into a single signal
- **Captures** live audio from your microphone via `getUserMedia` and `MediaStreamAudioSourceNode`
- **Renders offline snapshots** with `OfflineAudioContext` at selectable sample rates (8000–48000 Hz)
- **Analyses** time-domain samples and FFT magnitude data through `AnalyserNode`
- **Displays** a CRT-style oscilloscope trace of the waveform
- **Plots** the frequency spectrum with detected peak markers

## Run locally

```bash
npm install
npm run dev
```

### Tests

```bash
npm test
```

Open the URL shown in the terminal (typically http://localhost:5173).

### Live mode

Click **Start** to create the audio context (browser may require a user gesture). Choose **Synthesizer** or **Microphone** as the input source. Toggle individual waves, adjust frequency/amplitude, and optionally enable **Monitor audio** to hear the signal — use headphones when monitoring the mic to avoid feedback.

### Snapshot mode

Switch **Analysis mode** to **Snapshot (offline)**. Configure sine waves and pick a sample rate to explore bin width (`sample rate ÷ FFT size`). The lab renders one second of audio, then displays a static waveform and spectrum — similar to the [Shazizzle oscillator experiment](https://github.com/taylorjg/shazizzle/blob/master/js/client/experiments/oscillatorNodes.js).

## Stack

- React 19 + TypeScript
- Vite
- Web Audio API (`AudioContext`, `OfflineAudioContext`, `OscillatorNode`, `AnalyserNode`, `MediaStreamAudioSourceNode`)
