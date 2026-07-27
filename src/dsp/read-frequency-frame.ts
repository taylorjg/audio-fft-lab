import type { FftEngine } from "../types";
import { computeMagnitudeSpectrumDb } from "./magnitude-spectrum";

export function readFrequencyFrame(
  analyser: AnalyserNode,
  fftEngine: FftEngine,
  frequencyDomain: Float32Array,
  timeDomain: Float32Array
): void {
  if (fftEngine === "custom") {
    analyser.getFloatTimeDomainData(timeDomain);
    computeMagnitudeSpectrumDb(timeDomain, frequencyDomain);
    return;
  }

  analyser.getFloatFrequencyData(frequencyDomain);
}
