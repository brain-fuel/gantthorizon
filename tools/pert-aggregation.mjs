import { assertPertTriple, modifiedPertMean, modifiedPertVariance } from './pert-math.mjs';

function assertSubtasks(subtasks) {
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    throw new Error('Sequential aggregation requires at least one sub-task.');
  }
  subtasks.forEach((subtask, index) => {
    try {
      assertPertTriple(subtask);
    } catch (error) {
      throw new Error(`Invalid PERT values for sub-task ${index + 1}: ${error.message}`);
    }
  });
}

export function aggregateSequentialPert(subtasks, options = {}) {
  assertSubtasks(subtasks);
  const lambda = options.lambda;

  let mean = 0;
  let variance = 0;
  let bestSum = 0;
  let worstSum = 0;

  subtasks.forEach((subtask) => {
    const values = lambda ? { ...subtask, lambda } : subtask;
    mean += modifiedPertMean(values);
    variance += modifiedPertVariance(values);
    bestSum += values.best;
    worstSum += values.worst;
  });

  return {
    type: 'sequential',
    count: subtasks.length,
    mean,
    variance,
    standardDeviation: Math.sqrt(variance),
    support: { min: bestSum, max: worstSum }
  };
}
