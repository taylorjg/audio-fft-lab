# Audio FFT Lab

A small React/TypeScript experiment for exploring sine-wave synthesis and real-time spectral analysis using the Web Audio API.

## What it does

- **Synthesises** one or more sine waves via `OscillatorNode`, mixed into a single signal
- **Captures** time-domain samples and FFT magnitude data through `AnalyserNode`
- **Displays** a CRT-style oscilloscope trace (SVG) of the waveform
- **Plots** the frequency spectrum with detected peak markers

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically http://localhost:5173).

Click **Start** to create the audio context (browser may require a user gesture). Toggle individual waves, adjust frequency/amplitude, and optionally enable **Monitor audio** to hear the mix.

## Stack

- React 19 + TypeScript
- Vite
- Web Audio API (`AudioContext`, `OscillatorNode`, `AnalyserNode`)
