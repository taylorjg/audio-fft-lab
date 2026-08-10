import { renderSnapshot } from "@app/dsp/render-snapshot";

const hasOfflineAudio = typeof OfflineAudioContext !== "undefined";

describe("renderSnapshot validation", () => {
  it("requires at least one enabled wave", async () => {
    await expect(
      renderSnapshot(
        [{ id: "a", frequency: 440, amplitude: 1, enabled: false }],
        44100,
        2048,
        "web-audio"
      )
    ).rejects.toThrow(/at least one sine wave/i);
  });
});

describe.skipIf(!hasOfflineAudio)("renderSnapshot integration", () => {
  it("returns scope and spectrum data for a sine wave", async () => {
    const result = await renderSnapshot(
      [{ id: "a", frequency: 440, amplitude: 0.5, enabled: true }],
      44100,
      2048,
      "web-audio"
    );

    expect(result.timeDomain.length).toBe(1024);
    expect(result.frequencyDomain.length).toBe(1024);
    expect(result.peakFrequencies.length).toBeGreaterThan(0);
    expect(
      result.peakFrequencies.some((peak) => Math.abs(peak.frequency - 440) < 30)
    ).toBe(true);

    const peakAmplitude = Math.max(
      ...result.timeDomain.map((v) => Math.abs(v))
    );
    expect(peakAmplitude).toBeGreaterThan(0.05);
  });

  it("supports the custom FFT engine", async () => {
    const result = await renderSnapshot(
      [{ id: "a", frequency: 1000, amplitude: 0.4, enabled: true }],
      44100,
      2048,
      "custom"
    );

    expect(
      result.peakFrequencies.some(
        (peak) => Math.abs(peak.frequency - 1000) < 40
      )
    ).toBe(true);
  });
});
