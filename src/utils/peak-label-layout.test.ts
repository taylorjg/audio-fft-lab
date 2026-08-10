import {
  estimateLabelWidth,
  labelBandHeight,
  layoutPeakLabels,
} from "@app/utils/peak-label-layout";

describe("peak-label-layout", () => {
  it("estimates label width from text length", () => {
    expect(estimateLabelWidth("440 Hz")).toBeGreaterThan(
      estimateLabelWidth("10 Hz")
    );
  });

  it("returns zero band height when there are no peaks", () => {
    expect(labelBandHeight(0, false)).toBe(0);
  });

  it("assigns separate lanes for overlapping peak labels", () => {
    const placed = layoutPeakLabels(
      [
        { frequency: 440, magnitudeDb: -10, x: 100, y: 50 },
        { frequency: 445, magnitudeDb: -12, x: 108, y: 48 },
      ],
      48,
      600,
      40
    );

    expect(placed).toHaveLength(2);
    expect(placed[1]?.lane).toBeGreaterThan(placed[0]?.lane ?? 0);
  });
});
