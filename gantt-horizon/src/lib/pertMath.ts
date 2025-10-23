export interface PertEstimate {
  best: number;
  mostLikely: number;
  worst: number;
  lambda?: number;
}

export const DEFAULT_LAMBDA = 4;

export function assertPertTriple({ best, mostLikely, worst }: PertEstimate): void {
  if ([best, mostLikely, worst].some((value) => Number.isNaN(value) || typeof value !== 'number')) {
    throw new Error('PERT values must be numeric.');
  }

  if (best > mostLikely || mostLikely > worst) {
    throw new Error('PERT values must satisfy best ≤ mostLikely ≤ worst.');
  }

  if (best === worst) {
    throw new Error('PERT best and worst values cannot be identical.');
  }
}

export interface PertBetaParams {
  alpha: number;
  beta: number;
}

export function modifiedPertBetaParams(estimate: PertEstimate): PertBetaParams {
  const { best, mostLikely, worst, lambda = DEFAULT_LAMBDA } = estimate;
  assertPertTriple(estimate);

  if (lambda <= 0) {
    throw new Error('Lambda must be positive for Modified PERT.');
  }

  const range = worst - best;
  const alpha = 1 + (lambda * (mostLikely - best)) / range;
  const beta = 1 + (lambda * (worst - mostLikely)) / range;

  return { alpha, beta };
}

export function modifiedPertMean(estimate: PertEstimate): number {
  const { best, mostLikely, worst, lambda = DEFAULT_LAMBDA } = estimate;
  assertPertTriple(estimate);
  return (best + lambda * mostLikely + worst) / (lambda + 2);
}

export function modifiedPertVariance(estimate: PertEstimate): number {
  const { best, mostLikely, worst } = estimate;
  assertPertTriple(estimate);
  const range = worst - best;
  const { alpha, beta } = modifiedPertBetaParams(estimate);
  const numerator = alpha * beta * range * range;
  const denominator = (alpha + beta) ** 2 * (alpha + beta + 1);
  return numerator / denominator;
}
