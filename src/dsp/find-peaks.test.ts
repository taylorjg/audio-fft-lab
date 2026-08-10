import { findPeaks } from "./find-peaks";

function makeLocalPeakSpectrum(
  length: number,
  peaks: Array<{ bin: number; db: number }>
): Float32Array {
  const data = new Float32Array(length).fill(-90);

  for (const { bin, db } of peaks) {
    data[bin - 2] = db - 8;
    data[bin - 1] = db - 3;
    data[bin] = db;
    data[bin + 1] = db - 3;
    data[bin + 2] = db - 8;
  }

  return data;
}

describe("findPeaks", () => {
  it("detects local maxima above threshold", () => {
    const fftSize = 2048;
    const sampleRate = 44100;
    const binWidth = sampleRate / fftSize;
    const data = makeLocalPeakSpectrum(256, [
      { bin: 20, db: -12 },
      { bin: 80, db: -18 },
    ]);

    const peaks = findPeaks(data, sampleRate, fftSize);

    expect(peaks).toHaveLength(2);
    expect(peaks[0]?.frequency).toBeCloseTo(20 * binWidth, 5);
    expect(peaks[1]?.frequency).toBeCloseTo(80 * binWidth, 5);
  });

  it("limits results and sorts by frequency", () => {
    const data = makeLocalPeakSpectrum(128, [
      { bin: 10, db: -10 },
      { bin: 30, db: -8 },
      { bin: 50, db: -6 },
    ]);

    const peaks = findPeaks(data, 48000, 1024, -55, 2);

    expect(peaks).toHaveLength(2);
    expect(peaks[0]?.frequency).toBeLessThan(peaks[1]?.frequency ?? 0);
  });

  it("ignores bins below threshold", () => {
    const data = makeLocalPeakSpectrum(64, [{ bin: 12, db: -70 }]);

    expect(findPeaks(data, 44100, 2048, -55)).toHaveLength(0);
  });
});
