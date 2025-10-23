import assert from 'node:assert/strict';
import test from 'node:test';

import { JiraTestSandbox } from '../src/lib/jiraTestSandbox.js';

const missingEnv = ['JIRA_SITE', 'FORGE_EMAIL', 'FORGE_API_TOKEN'].filter((key) => !process.env[key]);

const testOptions: test.TestOptions = {
  timeout: 180_000,
  skip: missingEnv.length > 0
};

if (missingEnv.length > 0) {
  console.warn(`Skipping Jira sandbox test – missing env vars: ${missingEnv.join(', ')}`);
}

test('Jira sandbox scaffolding creates coverage dataset and cleans up project', testOptions, async () => {
  const sandbox = new JiraTestSandbox();
  const context = await sandbox.setup();
  try {
    const { project, issues } = context;
    assert.ok(project.key, 'project key should be defined');
    assert.ok(Array.isArray(issues.allIssues), 'issues collection should be an array');

    const requiredNodes = [
      issues.plainStory,
      issues.storyWithSubtasks,
      issues.plainTask,
      issues.taskWithSubtasks,
      issues.plainBug,
      issues.bugWithSubtasks
    ];

    requiredNodes.forEach((issue, index) => {
      assert.ok(issue, `required issue #${index + 1} was not created`);
    });

    if (issues.storyWithSubtasks) {
      assert.ok(
        Array.isArray(issues.storyWithSubtasks.subtasks) && issues.storyWithSubtasks.subtasks.length > 0,
        'story should have generated subtasks'
      );
    }

    if (issues.taskWithSubtasks) {
      assert.ok(
        Array.isArray(issues.taskWithSubtasks.subtasks) && issues.taskWithSubtasks.subtasks.length > 0,
        'task should have generated subtasks'
      );
    }

    if (issues.bugWithSubtasks) {
      assert.ok(
        Array.isArray(issues.bugWithSubtasks.subtasks) && issues.bugWithSubtasks.subtasks.length > 0,
        'bug should have generated subtasks'
      );
    }
  } finally {
    await sandbox.teardown();
  }
});
