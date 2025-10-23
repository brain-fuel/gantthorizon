import { assertPertTriple, modifiedPertMean, modifiedPertVariance, type PertEstimate } from './pertMath.js';

export interface AggregatedSequentialPert {
  type: 'sequential';
  count: number;
  mean: number;
  variance: number;
  standardDeviation: number;
  support: {
    min: number;
    max: number;
  };
}

export function aggregateSequentialPert(subtasks: PertEstimate[], lambda?: number): AggregatedSequentialPert {
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    throw new Error('Sequential aggregation requires at least one sub-task.');
  }

  subtasks.forEach((estimate, index) => {
    try {
      assertPertTriple(estimate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid PERT values for sub-task ${index + 1}: ${message}`);
    }
  });

  const summary = subtasks.reduce(
    (acc, estimate) => {
      const values = lambda !== undefined ? { ...estimate, lambda } : estimate;
      const mean = modifiedPertMean(values);
      const variance = modifiedPertVariance(values);
      acc.mean += mean;
      acc.variance += variance;
      acc.support.min += values.best;
      acc.support.max += values.worst;
      return acc;
    },
    {
      mean: 0,
      variance: 0,
      support: { min: 0, max: 0 }
    }
  );

  return {
    type: 'sequential',
    count: subtasks.length,
    mean: summary.mean,
    variance: summary.variance,
    standardDeviation: Math.sqrt(summary.variance),
    support: summary.support
  };
}
