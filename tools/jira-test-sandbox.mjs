const DEFAULT_TEMPLATE = 'com.pyxis.greenhopper.jira:gh-scrum-template';
const DEFAULT_PROJECT_TYPE = 'software';

const DEFAULT_LABELS = ['gantt-horizon', 'auto-generated'];
const DEFAULT_PRIORITY = 'Medium';

const REQUIRED_ENV_VARS = ['JIRA_SITE', 'FORGE_EMAIL', 'FORGE_API_TOKEN'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing environment variables for Jira test sandbox: ${missing.join(', ')}`
    );
  }
}

function getBaseUrl() {
  const site = process.env.JIRA_SITE;
  if (!site) {
    throw new Error('JIRA_SITE environment variable is not set.');
  }
  return site.startsWith('http') ? `${site.replace(/\/$/, '')}/rest/api/3` : `https://${site}/rest/api/3`;
}

function buildAuthHeaders() {
  const email = process.env.FORGE_EMAIL;
  const token = process.env.FORGE_API_TOKEN;
  if (!email || !token) {
    throw new Error('FORGE_EMAIL and FORGE_API_TOKEN must be defined for Jira API access.');
  }
  const encoded = Buffer.from(`${email}:${token}`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    Accept: 'application/json'
  };
}

async function jiraRequest(path, { method = 'GET', body, headers = {}, searchParams } = {}) {
  ensureEnv();
  const baseUrl = getBaseUrl();
  const url = new URL(path.replace(/^\//, ''), `${baseUrl}/`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });
  }
  const init = {
    method,
    headers: { ...buildAuthHeaders(), ...headers }
  };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, init);
  if (response.status === 204 || response.status === 202) {
    return null;
  }
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const parsed = text ? JSON.parse(text) : {};
      message = parsed.errorMessages ? parsed.errorMessages.join('\n') : text;
    } catch {
      // ignore JSON parse error, fall back to raw text
    }
    throw new Error(`Jira API ${method} ${url.pathname} failed (${response.status}): ${message}`);
  }
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function randomProjectKey(prefix = 'GHT') {
  const suffix = Math.random().toString(36).replace(/[^a-z0-9]+/gi, '').slice(0, 4).toUpperCase();
  return `${prefix}${suffix}`.slice(0, 10);
}

function toADF(text) {
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text
          }
        ]
      }
    ]
  };
}

function formatDueDate(daysFromNow = 7) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

async function getCurrentUser() {
  return jiraRequest('/myself');
}

async function waitForProjectAvailability(key, maxAttempts = 10, delayMs = 1000) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const project = await jiraRequest(`/project/${key}`);
      if (project) {
        return project;
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error;
      }
    }
    await sleep(delayMs);
  }
  throw new Error(`Timed out waiting for project ${key} to become available.`);
}

async function createProject(options = {}) {
  const { accountId } = await getCurrentUser();
  const key = options.key ?? randomProjectKey();
  const name = options.name ?? `Gantt Horizon Test ${key}`;
  const payload = {
    key,
    name,
    projectTypeKey: options.projectTypeKey ?? DEFAULT_PROJECT_TYPE,
    projectTemplateKey: options.projectTemplateKey ?? DEFAULT_TEMPLATE,
    leadAccountId: accountId,
    assigneeType: 'PROJECT_LEAD'
  };
  const project = await jiraRequest('/project', { method: 'POST', body: payload });
  await waitForProjectAvailability(project.key);
  return project;
}

async function deleteProject(projectIdOrKey) {
  await jiraRequest(`/project/${projectIdOrKey}`, { method: 'DELETE' });
}

async function getCreateMeta(projectKey) {
  const meta = await jiraRequest('/issue/createmeta', {
    searchParams: {
      projectKeys: projectKey,
      expand: 'projects.issuetypes.fields'
    }
  });
  const project = meta?.projects?.[0];
  if (!project) {
    throw new Error(`No create metadata returned for project ${projectKey}`);
  }
  const types = {};
  project.issuetypes.forEach((type) => {
    const fieldsByName = {};
    Object.entries(type.fields).forEach(([fieldId, fieldInfo]) => {
      if (fieldInfo?.name) {
        fieldsByName[fieldInfo.name] = { id: fieldId, ...fieldInfo };
      }
    });
    types[type.name] = {
      id: type.id,
      name: type.name,
      fieldsByName,
      rawFields: type.fields
    };
  });
  return types;
}

async function createIssue({
  projectKey,
  issueType,
  summary,
  description,
  labels = DEFAULT_LABELS,
  dueInDays = 7,
  priorityName = DEFAULT_PRIORITY,
  parentIssue,
  epicIssue,
  additionalFields = {}
}) {
  const fields = {
    project: { key: projectKey },
    issuetype: { id: issueType.id },
    summary,
    description: toADF(description ?? summary),
    labels,
    duedate: formatDueDate(dueInDays),
    priority: { name: priorityName },
    ...additionalFields
  };

  if (parentIssue) {
    fields.parent = { key: parentIssue.key };
  }

  // Handle Epic specific requirements
  const epicNameField = issueType.fieldsByName?.['Epic Name'];
  if (epicNameField) {
    fields[epicNameField.id] = summary;
  }

  // Link child issues back to the epic when possible.
  if (epicIssue) {
    const epicLinkField = issueType.fieldsByName?.['Epic Link'] ?? issueType.fieldsByName?.['Parent'];
    if (epicLinkField?.schema?.type === 'any') {
      fields[epicLinkField.id] = epicIssue.key;
    } else if (fields.parent === undefined) {
      // Team-managed projects use the parent field for epics as well.
      fields.parent = { key: epicIssue.key };
    }
  }

  const response = await jiraRequest('/issue', { method: 'POST', body: { fields } });
  return { ...response, summary, issueType: issueType.name };
}

async function createSubtask({ projectKey, issueType, parentIssue, summary, description, labels }) {
  if (!parentIssue) {
    throw new Error('Sub-task creation requires a parent issue.');
  }
  return createIssue({
    projectKey,
    issueType,
    parentIssue,
    summary,
    description,
    labels
  });
}

async function createDemoIssues(project, issueTypes) {
  const results = {
    allIssues: []
  };

  const subTaskType = issueTypes['Sub-task'];
  const epicType = issueTypes['Epic'];

  if (epicType) {
    const epic = await createIssue({
      projectKey: project.key,
      issueType: epicType,
      summary: 'Compass & Frame Scheduling Epic',
      description: 'Umbrella work item generated for automated testing.'
    });
    results.epic = epic;
    results.allIssues.push(epic);
  }

  const storyType = issueTypes['Story'];
  if (storyType) {
    const plainStory = await createIssue({
      projectKey: project.key,
      issueType: storyType,
      summary: 'Plain Story',
      description: 'Story without children for baseline calculations.',
      epicIssue: results.epic
    });
    results.plainStory = plainStory;
    results.allIssues.push(plainStory);

    const storyWithSubtasks = await createIssue({
      projectKey: project.key,
      issueType: storyType,
      summary: 'Story With Subtasks',
      description: 'Story containing autogenerated subtasks.',
      epicIssue: results.epic
    });
    results.storyWithSubtasks = storyWithSubtasks;
    results.allIssues.push(storyWithSubtasks);

    if (subTaskType) {
      results.storyWithSubtasks.subtasks = [];
      for (let i = 1; i <= 2; i += 1) {
        const sub = await createSubtask({
          projectKey: project.key,
          issueType: subTaskType,
          parentIssue: storyWithSubtasks,
          summary: `Story Sub-task ${i}`,
          description: 'Autogenerated sub-task for story coverage.'
        });
        results.storyWithSubtasks.subtasks.push(sub);
        results.allIssues.push(sub);
      }
    }
  }

  const taskType = issueTypes['Task'];
  if (taskType) {
    const plainTask = await createIssue({
      projectKey: project.key,
      issueType: taskType,
      summary: 'Plain Task',
      description: 'Task without subtasks for coverage.'
    });
    results.plainTask = plainTask;
    results.allIssues.push(plainTask);

    const taskWithSubtasks = await createIssue({
      projectKey: project.key,
      issueType: taskType,
      summary: 'Task With Subtasks',
      description: 'Task that contains autogenerated subtasks.'
    });
    results.taskWithSubtasks = taskWithSubtasks;
    results.allIssues.push(taskWithSubtasks);

    if (subTaskType) {
      results.taskWithSubtasks.subtasks = [];
      for (let i = 1; i <= 2; i += 1) {
        const sub = await createSubtask({
          projectKey: project.key,
          issueType: subTaskType,
          parentIssue: taskWithSubtasks,
          summary: `Task Sub-task ${i}`,
          description: 'Autogenerated sub-task for task coverage.'
        });
        results.taskWithSubtasks.subtasks.push(sub);
        results.allIssues.push(sub);
      }
    }
  }

  const bugType = issueTypes['Bug'];
  if (bugType) {
    const plainBug = await createIssue({
      projectKey: project.key,
      issueType: bugType,
      summary: 'Plain Bug',
      description: 'Bug without subtasks for coverage.',
      epicIssue: results.epic
    });
    results.plainBug = plainBug;
    results.allIssues.push(plainBug);

    const bugWithSubtasks = await createIssue({
      projectKey: project.key,
      issueType: bugType,
      summary: 'Bug With Subtasks',
      description: 'Bug that contains autogenerated subtasks.',
      epicIssue: results.epic
    });
    results.bugWithSubtasks = bugWithSubtasks;
    results.allIssues.push(bugWithSubtasks);

    if (subTaskType) {
      results.bugWithSubtasks.subtasks = [];
      for (let i = 1; i <= 2; i += 1) {
        const sub = await createSubtask({
          projectKey: project.key,
          issueType: subTaskType,
          parentIssue: bugWithSubtasks,
          summary: `Bug Sub-task ${i}`,
          description: 'Autogenerated sub-task for bug coverage.'
        });
        results.bugWithSubtasks.subtasks.push(sub);
        results.allIssues.push(sub);
      }
    }
  }

  return results;
}

export class JiraTestSandbox {
  constructor(options = {}) {
    this.options = options;
    this.project = null;
    this.issueTypes = null;
    this.issues = null;
  }

  async setup() {
    this.project = await createProject(this.options.project);
    this.issueTypes = await getCreateMeta(this.project.key);
    this.issues = await createDemoIssues(this.project, this.issueTypes);
    return {
      project: this.project,
      issueTypes: this.issueTypes,
      issues: this.issues
    };
  }

  async teardown() {
    if (this.project) {
      try {
        await deleteProject(this.project.id);
      } catch (error) {
        console.warn(
          `Failed to delete Jira project during teardown (id=${this.project.id}, key=${this.project.key}).`,
          error
        );
      }
    }
    this.project = null;
    this.issueTypes = null;
    this.issues = null;
  }

  async run(callback) {
    const context = await this.setup();
    try {
      return await callback(context);
    } finally {
      await this.teardown();
    }
  }
}

export async function withJiraTestProject(callback, options) {
  const sandbox = new JiraTestSandbox(options);
  return sandbox.run(callback);
}

export { createProject, deleteProject, createDemoIssues };
