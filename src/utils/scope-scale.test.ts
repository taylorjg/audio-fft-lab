import {
  computeScopeScale,
  formatScopeAmplitude,
  formatScopeTime,
  SCOPE_TIME_DIVISIONS,
} from "./scope-scale";

describe("computeScopeScale", () => {
  it("derives window length from fftSize / 2 samples", () => {
    const sampleRate = 48000;
    const fftSize = 2048;
    const scale = computeScopeScale(sampleRate, fftSize);

    expect(scale.windowMs).toBeCloseTo((1024 / sampleRate) * 1000, 5);
    expect(scale.timeTicks).toHaveLength(SCOPE_TIME_DIVISIONS + 1);
    expect(scale.timeTicks[0]).toBe(0);
    expect(scale.timeTicks.at(-1)).toBeCloseTo(scale.windowMs, 5);
  });
});

describe("formatScopeTime", () => {
  it("formats sub-millisecond values in microseconds", () => {
    expect(formatScopeTime(0.5)).toBe("500 µs");
  });

  it("formats millisecond values with sensible precision", () => {
    expect(formatScopeTime(12.3)).toBe("12.3 ms");
    expect(formatScopeTime(150)).toBe("150 ms");
  });
});

describe("formatScopeAmplitude", () => {
  it("rounds tiny values to zero", () => {
    expect(formatScopeAmplitude(0.0004)).toBe("0.00");
  });
});
