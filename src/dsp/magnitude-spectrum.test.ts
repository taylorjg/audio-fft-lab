import {
  computeMagnitudeSpectrumDb,
  hannWindow,
  linearToDb,
} from "@app/dsp/magnitude-spectrum";
import { makeSineFrame, peakBinIndex } from "@app/test/sine-frame";

describe("linearToDb", () => {
  it("converts unity gain near 0 dB", () => {
    expect(linearToDb(1)).toBeCloseTo(0, 5);
  });

  it("clamps to floor for tiny values", () => {
    expect(linearToDb(0)).toBe(-90);
  });
});

describe("hannWindow", () => {
  it("tapers to zero at both ends", () => {
    const window = hannWindow(512);
    expect(window[0]).toBe(0);
    expect(window[511]).toBe(0);
    expect(window[256]).toBeCloseTo(1, 4);
  });
});

describe("computeMagnitudeSpectrumDb", () => {
  it("finds energy near a bin-aligned sine", () => {
    const fftSize = 2048;
    const sampleRate = 44100;
    const frequency = 440;
    const timeDomain = makeSineFrame(frequency, sampleRate, fftSize);
    const spectrum = new Float32Array(fftSize / 2);

    computeMagnitudeSpectrumDb(timeDomain, spectrum);

    const binWidth = sampleRate / fftSize;
    const expectedBin = Math.round(frequency / binWidth);
    const peakBin = peakBinIndex(spectrum);

    expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(1);
    expect(spectrum[peakBin]).toBeGreaterThan(-12);
  });
});
