import assert from 'node:assert/strict';
import test from 'node:test';

import { aggregateSequentialPert } from '../tools/pert-aggregation.mjs';
import { modifiedPertMean, modifiedPertVariance } from '../tools/pert-math.mjs';

function buildScenario(subtaskCount) {
  const subtasks = [];
  for (let i = 1; i <= subtaskCount; i += 1) {
    const best = i;
    const mostLikely = i + 1;
    const worst = i + 3;
    subtasks.push({ best, mostLikely, worst });
  }
  return subtasks;
}

function expectedSequentialSummary(subtasks) {
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

function almostEqual(a, b, tolerance = 1e-9) {
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

