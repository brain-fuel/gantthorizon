import assert from 'node:assert/strict';
import test from 'node:test';

import { JiraTestSandbox, jiraRequest } from '../src/lib/jiraTestSandbox.js';
import { createPertTask, getPertEstimate, validatePertHours } from '../src/lib/pertTask.js';

const missingEnv = ['JIRA_SITE', 'FORGE_EMAIL', 'FORGE_API_TOKEN'].filter((key) => !process.env[key]);

const testOptions: test.TestOptions = {
  timeout: 180_000,
  skip: missingEnv.length > 0
};

if (missingEnv.length > 0) {
  console.warn(`Skipping PERT task tests – missing env vars: ${missingEnv.join(', ')}`);
}

const VALID_ESTIMATES = {
  best: 4,
  mostLikely: 6,
  worst: 10
};

test('validatePertHours enforces numeric ordering', () => {
  assert.throws(
    () => validatePertHours({ best: Number.NaN, mostLikely: 6, worst: 7 }),
    /numeric hour values/
  );
  assert.throws(() => validatePertHours({ best: -1, mostLikely: 2, worst: 3 }), /cannot be negative/);
  assert.throws(
    () => validatePertHours({ best: 4, mostLikely: 3, worst: 5 }),
    /best-case ≤ nominal ≤ worst-case/
  );
  assert.doesNotThrow(() => validatePertHours(VALID_ESTIMATES));
});

test('createPertTask stores estimates on the issue property', testOptions, async () => {
  const sandbox = new JiraTestSandbox();
  let context;
  try {
    context = await sandbox.setup();
  } catch (error) {
    console.error('Sandbox setup failed', error);
    throw error;
  }
  try {
    const { project } = context;
    const { issue, estimatePropertyKey } = await createPertTask({
      projectKey: project.key,
      summary: 'PERT Coverage Task',
      ...VALID_ESTIMATES
    });

    assert.ok(issue.key, 'Issue creation failed to return a key');

    const expectedProperty = {
      bestCaseHours: VALID_ESTIMATES.best,
      nominalHours: VALID_ESTIMATES.mostLikely,
      worstCaseHours: VALID_ESTIMATES.worst,
      ...VALID_ESTIMATES
    };

    const stored = await jiraRequest<{ value: typeof expectedProperty }>(
      `/issue/${issue.key}/properties/${estimatePropertyKey}`
    );
    assert.ok(stored, 'PERT estimate property should exist');
    assert.deepEqual(stored.value, expectedProperty);

    const getterValue = await getPertEstimate(issue.key);
    assert.deepEqual(getterValue, expectedProperty);
  } finally {
    await sandbox.teardown();
  }
});

test('createPertTask detects unavailable issue types', testOptions, async () => {
  const sandbox = new JiraTestSandbox();
  let context;
  try {
    context = await sandbox.setup();
  } catch (error) {
    console.error('Sandbox setup failed', error);
    throw error;
  }
  try {
    const { project } = context;
    await assert.rejects(
      () =>
        createPertTask({
          projectKey: project.key,
          issueTypeName: 'Nonexistent',
          ...VALID_ESTIMATES
        }),
      /Issue type "Nonexistent" is not available/
    );
  } finally {
    await sandbox.teardown();
  }
});
