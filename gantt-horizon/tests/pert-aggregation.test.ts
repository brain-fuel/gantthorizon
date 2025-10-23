import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregateSequentialPert } from '../src/lib/pertAggregation.js';
import { modifiedPertMean, modifiedPertVariance, type PertEstimate } from '../src/lib/pertMath.js';

function buildScenario(subtaskCount: number): PertEstimate[] {
  return Array.from({ length: subtaskCount }, (_, index) => {
    const i = index + 1;
    return {
      best: i,
      mostLikely: i + 1,
      worst: i + 3
    };
  });
}

function expectedSequentialSummary(subtasks: PertEstimate[]) {
  const mean = subtasks.reduce((acc, values) => acc + modifiedPertMean(values), 0);
  const variance = subtasks.reduce((acc, values) => acc + modifiedPertVariance(values), 0);
  const support = subtasks.reduce(
    (acc, values) => ({
      min: acc.min + values.best,
      max: acc.max + values.worst
    }),
    { min: 0, max: 0 }
  );
  return { mean, variance, support };
}

function almostEqual(a: number, b: number, tolerance = 1e-9): boolean {
  return Math.abs(a - b) <= tolerance;
}

for (let count = 1; count <= 10; count += 1) {
  test(`aggregateSequentialPert handles ${count} sub-task(s)`, () => {
    const subtasks = buildScenario(count);
    const summary = aggregateSequentialPert(subtasks);
    const expected = expectedSequentialSummary(subtasks);

    assert.equal(summary.count, count);
    assert.ok(almostEqual(summary.mean, expected.mean));
    assert.ok(almostEqual(summary.variance, expected.variance));
    assert.ok(almostEqual(summary.standardDeviation ** 2, expected.variance));
    assert.deepEqual(summary.support, expected.support);
  });
}
