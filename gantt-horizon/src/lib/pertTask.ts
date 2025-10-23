import { createIssue, getCreateMeta, jiraRequest } from './jiraTestSandbox.js';
import type { PertEstimate } from './pertMath.js';

const DEFAULT_SUMMARY = 'PERT Estimated Task';
const DEFAULT_DESCRIPTION = 'Auto-generated task with PERT estimates.';
const ISSUE_PROPERTY_KEY = 'gantt-horizon-pert-estimate';

export interface CreatePertTaskOptions extends PertEstimate {
  projectKey: string;
  summary?: string;
  description?: string;
  issueTypeName?: string;
}

function validatePertHours({ best, mostLikely, worst }: PertEstimate): void {
  if ([best, mostLikely, worst].some((value) => typeof value !== 'number' || Number.isNaN(value))) {
    throw new Error('PERT estimates must be numeric hour values.');
  }

  if (best > mostLikely || mostLikely > worst) {
    throw new Error('PERT estimates must satisfy: best-case ≤ nominal ≤ worst-case.');
  }

  if (best < 0 || mostLikely < 0 || worst < 0) {
    throw new Error('PERT estimates cannot be negative.');
  }
}

export async function createPertTask(options: CreatePertTaskOptions) {
  const {
    projectKey,
    summary = DEFAULT_SUMMARY,
    description = DEFAULT_DESCRIPTION,
    best,
    mostLikely,
    worst,
    issueTypeName = 'Task',
    lambda
  } = options;

  if (!projectKey) {
    throw new Error('projectKey is required to create a PERT task.');
  }

  validatePertHours({ best, mostLikely, worst, lambda });

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

  const propertyValue: PertEstimateProperty = {
    bestCaseHours: best,
    nominalHours: mostLikely,
    worstCaseHours: worst,
    best,
    mostLikely,
    worst
  };

  await jiraRequest(`/issue/${issue.key}/properties/${ISSUE_PROPERTY_KEY}`, {
    method: 'PUT',
    body: propertyValue
  });

  return {
    issue,
    estimatePropertyKey: ISSUE_PROPERTY_KEY
  };
}

export interface PertEstimateProperty {
  bestCaseHours: number;
  nominalHours: number;
  worstCaseHours: number;
  best: number;
  mostLikely: number;
  worst: number;
}

export async function getPertEstimate(issueKey: string): Promise<PertEstimateProperty | null> {
  if (!issueKey) {
    throw new Error('issueKey is required to read PERT estimates.');
  }

  const response = await jiraRequest<{ value?: PertEstimateProperty }>(
    `/issue/${issueKey}/properties/${ISSUE_PROPERTY_KEY}`
  );
  return response?.value ?? null;
}

export { validatePertHours };
