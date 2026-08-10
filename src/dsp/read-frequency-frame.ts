import { computeMagnitudeSpectrumDb } from "@app/dsp/magnitude-spectrum";
import type { FftEngine } from "@app/types";

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
