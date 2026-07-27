export class FftPlan {
  readonly size: number;
  private readonly reverse: Uint32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of 2, got ${size}`);
    }

    this.size = size;
    this.reverse = new Uint32Array(size);

    const bits = Math.round(Math.log2(size));
    for (let i = 0; i < size; i++) {
      let reversed = 0;
      for (let bit = 0; bit < bits; bit++) {
        if (i & (1 << bit)) {
          reversed |= 1 << (bits - 1 - bit);
        }
      }
      this.reverse[i] = reversed;
    }
  }

  forward(
    input: Float32Array,
    realOut: Float64Array,
    imagOut: Float64Array
  ): void {
    const n = this.size;

    for (let i = 0; i < n; i++) {
      const j = this.reverse[i] ?? i;
      realOut[j] = input[i] ?? 0;
      imagOut[j] = 0;
    }

    for (let blockSize = 2; blockSize <= n; blockSize <<= 1) {
      const halfBlock = blockSize >> 1;
      const step = n / blockSize;

      for (let i = 0; i < n; i += blockSize) {
        for (let j = 0; j < halfBlock; j++) {
          const twiddleIndex = j * step;
          const angle = (-2 * Math.PI * twiddleIndex) / n;
          const wr = Math.cos(angle);
          const wi = Math.sin(angle);

          const evenIndex = i + j;
          const oddIndex = evenIndex + halfBlock;
          const oddReal = realOut[oddIndex] ?? 0;
          const oddImag = imagOut[oddIndex] ?? 0;

          const tr = wr * oddReal - wi * oddImag;
          const ti = wr * oddImag + wi * oddReal;

          const evenReal = realOut[evenIndex] ?? 0;
          const evenImag = imagOut[evenIndex] ?? 0;

          realOut[oddIndex] = evenReal - tr;
          imagOut[oddIndex] = evenImag - ti;
          realOut[evenIndex] = evenReal + tr;
          imagOut[evenIndex] = evenImag + ti;
        }
      }
    }
  }
}

const planCache = new Map<number, FftPlan>();

export function getFftPlan(size: number): FftPlan {
  let plan = planCache.get(size);
  if (!plan) {
    plan = new FftPlan(size);
    planCache.set(size, plan);
  }
  return plan;
}
