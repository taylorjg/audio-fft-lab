# Audio FFT Lab

A small React/TypeScript experiment for exploring sine-wave synthesis, live microphone capture, and real-time spectral analysis using the Web Audio API.

## What it does

- **Synthesises** one or more sine waves via `OscillatorNode`, mixed into a single signal
- **Captures** live audio from your microphone via `getUserMedia` and `MediaStreamAudioSourceNode`
- **Analyses** time-domain samples and FFT magnitude data through `AnalyserNode`
- **Displays** a CRT-style oscilloscope trace of the waveform
- **Plots** the frequency spectrum with detected peak markers

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically http://localhost:5173).

Click **Start** to create the audio context (browser may require a user gesture). Choose **Synthesizer** or **Microphone** as the input source. Toggle individual waves, adjust frequency/amplitude, and optionally enable **Monitor audio** to hear the signal — use headphones when monitoring the mic to avoid feedback.

## Stack

- React 19 + TypeScript
- Vite
- Web Audio API (`AudioContext`, `OscillatorNode`, `AnalyserNode`, `MediaStreamAudioSourceNode`)
