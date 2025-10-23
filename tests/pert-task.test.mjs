import assert from 'node:assert/strict';
import test from 'node:test';

import { JiraTestSandbox, jiraRequest } from '../tools/jira-test-sandbox.mjs';
import { createPertTask, getPertEstimate, validatePertHours } from '../tools/pert-task.mjs';

const missingEnv = ['JIRA_SITE', 'FORGE_EMAIL', 'FORGE_API_TOKEN'].filter((key) => !process.env[key]);

const testOptions = {
  timeout: 180_000,
  skip: missingEnv.length > 0
};

if (missingEnv.length > 0) {
  console.warn(`Skipping PERT task tests – missing env vars: ${missingEnv.join(', ')}`);
}

const VALID_ESTIMATES = {
  bestCaseHours: 4,
  nominalHours: 6,
  worstCaseHours: 10
};

test('validatePertHours enforces numeric ordering', () => {
  assert.throws(() => validatePertHours({ bestCaseHours: '4', nominalHours: 6, worstCaseHours: 7 }), /numeric/);
  assert.throws(() => validatePertHours({ bestCaseHours: -1, nominalHours: 2, worstCaseHours: 3 }), /cannot be negative/);
  assert.throws(() => validatePertHours({ bestCaseHours: 4, nominalHours: 3, worstCaseHours: 5 }), /best-case ≤ nominal ≤ worst-case/);
  assert.doesNotThrow(() => validatePertHours(VALID_ESTIMATES));
});

test('createPertTask stores estimates on the issue property', testOptions, async () => {
  const sandbox = new JiraTestSandbox();
  const context = await sandbox.setup();
  try {
    const { project } = context;
    const { issue, estimatePropertyKey } = await createPertTask({
      projectKey: project.key,
      summary: 'PERT Coverage Task',
      ...VALID_ESTIMATES
    });

    assert.ok(issue.key, 'Issue creation failed to return a key');

    const stored = await jiraRequest(`/issue/${issue.key}/properties/${estimatePropertyKey}`);
    assert.ok(stored, 'PERT estimate property should exist');
    assert.deepEqual(stored.value, VALID_ESTIMATES);

    const getterValue = await getPertEstimate(issue.key);
    assert.deepEqual(getterValue, VALID_ESTIMATES);
  } finally {
    await sandbox.teardown();
  }
});

test('createPertTask detects unavailable issue types', testOptions, async () => {
  const sandbox = new JiraTestSandbox();
  const context = await sandbox.setup();
  try {
    const { project } = context;
    await assert.rejects(
      () => createPertTask({
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
