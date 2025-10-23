export const DEFAULT_LAMBDA = 4;

export function assertPertTriple({ best, mostLikely, worst }) {
  if ([best, mostLikely, worst].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    throw new Error('PERT values must be numeric.');
  }
  if (best > mostLikely || mostLikely > worst) {
    throw new Error('PERT values must satisfy best ≤ mostLikely ≤ worst.');
  }
  if (best === worst) {
    throw new Error('PERT best and worst values cannot be identical.');
  }
}

export function modifiedPertBetaParams({ best, mostLikely, worst, lambda = DEFAULT_LAMBDA }) {
  assertPertTriple({ best, mostLikely, worst });
  if (lambda <= 0) {
    throw new Error('Lambda must be positive for Modified PERT.');
  }
  const range = worst - best;
  const alpha = 1 + (lambda * (mostLikely - best)) / range;
  const beta = 1 + (lambda * (worst - mostLikely)) / range;
  return { alpha, beta };
}

export function modifiedPertMean({ best, mostLikely, worst, lambda = DEFAULT_LAMBDA }) {
  assertPertTriple({ best, mostLikely, worst });
  return (best + lambda * mostLikely + worst) / (lambda + 2);
}

export function modifiedPertVariance({ best, mostLikely, worst, lambda = DEFAULT_LAMBDA }) {
  assertPertTriple({ best, mostLikely, worst });
  const range = worst - best;
  const { alpha, beta } = modifiedPertBetaParams({ best, mostLikely, worst, lambda });
  const numerator = alpha * beta * range * range;
  const denominator = (alpha + beta) ** 2 * (alpha + beta + 1);
  return numerator / denominator;
}
