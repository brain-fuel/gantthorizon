import { createIssue, getCreateMeta, jiraRequest } from './jira-test-sandbox.mjs';

const DEFAULT_SUMMARY = 'PERT Estimated Task';
const DEFAULT_DESCRIPTION = 'Auto-generated task with PERT estimates.';
const ISSUE_PROPERTY_KEY = 'gantt-horizon-pert-estimate';

export function validatePertHours({ bestCaseHours, nominalHours, worstCaseHours }) {
  const values = [bestCaseHours, nominalHours, worstCaseHours];
  if (values.some((value) => typeof value !== 'number' || Number.isNaN(value))) {
    throw new Error('PERT estimates must be numeric hour values.');
  }
  if (values.some((value) => value < 0)) {
    throw new Error('PERT estimates cannot be negative.');
  }
  if (!(bestCaseHours <= nominalHours && nominalHours <= worstCaseHours)) {
    throw new Error('PERT estimates must satisfy: best-case ≤ nominal ≤ worst-case.');
  }
}

export async function createPertTask({
  projectKey,
  summary = DEFAULT_SUMMARY,
  description = DEFAULT_DESCRIPTION,
  bestCaseHours,
  nominalHours,
  worstCaseHours,
  issueTypeName = 'Task'
}) {
  if (!projectKey) {
    throw new Error('projectKey is required to create a PERT task.');
  }

  validatePertHours({ bestCaseHours, nominalHours, worstCaseHours });

  const issueTypes = await getCreateMeta(projectKey);
  const issueType = issueTypes[issueTypeName];
  if (!issueType) {
    throw new Error(`Issue type "${issueTypeName}" is not available in project ${projectKey}.`);
  }

  const issue = await createIssue({
    projectKey,
    issueType,
    summary,
    description
  });

  await jiraRequest(`/issue/${issue.key}/properties/${ISSUE_PROPERTY_KEY}`, {
    method: 'PUT',
    body: {
      bestCaseHours,
      nominalHours,
      worstCaseHours
    }
  });

  return {
    issue,
    estimatePropertyKey: ISSUE_PROPERTY_KEY
  };
}

export async function getPertEstimate(issueKey) {
  if (!issueKey) {
    throw new Error('issueKey is required to read PERT estimates.');
  }
  const response = await jiraRequest(`/issue/${issueKey}/properties/${ISSUE_PROPERTY_KEY}`);
  return response?.value ?? null;
}
