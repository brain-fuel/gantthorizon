const DEFAULT_TEMPLATE = 'com.pyxis.greenhopper.jira:gh-scrum-template';
const DEFAULT_PROJECT_TYPE = 'software';

const DEFAULT_LABELS = ['gantt-horizon', 'auto-generated'];
const DEFAULT_PRIORITY = 'Medium';

const REQUIRED_ENV_VARS = ['JIRA_SITE', 'FORGE_EMAIL', 'FORGE_API_TOKEN'] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables for Jira test sandbox: ${missing.join(', ')}`);
  }
}

function getBaseUrl(): string {
  const site = process.env.JIRA_SITE;
  if (!site) {
    throw new Error('JIRA_SITE environment variable is not set.');
  }
  return site.startsWith('http') ? `${site.replace(/\/$/, '')}/rest/api/3` : `https://${site}/rest/api/3`;
}

function buildAuthHeaders(): Record<string, string> {
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

interface JiraRequestOptions extends Omit<RequestInit, 'body'> {
  searchParams?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export async function jiraRequest<T = unknown>(
  path: string,
  { method = 'GET', body, headers = {}, searchParams, ...rest }: JiraRequestOptions = {}
): Promise<T> {
  ensureEnv();
  const baseUrl = getBaseUrl();
  const url = new URL(path.replace(/^\//, ''), `${baseUrl}/`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const init: RequestInit = {
    method,
    headers: { ...buildAuthHeaders(), ...headers },
    ...rest
  };

  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, init);
  if (response.status === 204 || response.status === 202) {
    return null as T;
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
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

function randomProjectKey(prefix = 'GHT'): string {
  const suffix = Math.random().toString(36).replace(/[^a-z0-9]+/gi, '').slice(0, 4).toUpperCase();
  return `${prefix}${suffix}`.slice(0, 10);
}

function toADF(text: string) {
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

function formatDueDate(daysFromNow = 7): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

interface JiraUser {
  accountId: string;
  [key: string]: unknown;
}

async function getCurrentUser(): Promise<JiraUser> {
  return jiraRequest<JiraUser>('/myself');
}

async function waitForProjectAvailability(key: string, maxAttempts = 10, delayMs = 1000) {
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

interface CreateProjectOptions {
  key?: string;
  name?: string;
  projectTypeKey?: string;
  projectTemplateKey?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  [key: string]: unknown;
}

export async function createProject(options: CreateProjectOptions = {}): Promise<JiraProject> {
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

  const project = await jiraRequest<JiraProject>('/project', { method: 'POST', body: payload });
  await waitForProjectAvailability(project.key);
  return project;
}

export async function deleteProject(projectIdOrKey: string): Promise<void> {
  await jiraRequest(`/project/${projectIdOrKey}`, { method: 'DELETE' });
}

export interface JiraFieldInfo {
  id: string;
  name: string;
  schema?: { type?: string };
  [key: string]: unknown;
}

export interface JiraIssueType {
  id: string;
  name: string;
  fieldsByName: Record<string, JiraFieldInfo>;
  rawFields: Record<string, JiraFieldInfo>;
}

export type JiraIssueTypeMap = Record<string, JiraIssueType>;

export async function getCreateMeta(projectKey: string): Promise<JiraIssueTypeMap> {
  const meta = await jiraRequest<{
    projects?: Array<{
      issuetypes: Array<{
        id: string;
        name: string;
        fields: Record<string, JiraFieldInfo>;
      }>;
    }>;
  }>('/issue/createmeta', {
    searchParams: {
      projectKeys: projectKey,
      expand: 'projects.issuetypes.fields'
    }
  });

  const project = meta?.projects?.[0];
  if (!project) {
    throw new Error(`No create metadata returned for project ${projectKey}`);
  }

  const types: JiraIssueTypeMap = {};
  project.issuetypes.forEach((type) => {
    const fieldsByName: Record<string, JiraFieldInfo> = {};
    Object.entries(type.fields).forEach(([fieldId, fieldInfo]) => {
      if (fieldInfo?.name) {
        fieldsByName[fieldInfo.name] = { ...fieldInfo, id: fieldId };
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

interface CreateIssueOptions {
  projectKey: string;
  issueType: JiraIssueType;
  summary: string;
  description?: string;
  labels?: string[];
  dueInDays?: number;
  priorityName?: string;
  parentIssue?: { key: string };
  epicIssue?: { key: string };
  additionalFields?: Record<string, unknown>;
}

export interface JiraIssue {
  id: string;
  key: string;
  [key: string]: unknown;
}

export async function createIssue({
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
}: CreateIssueOptions): Promise<JiraIssue> {
  const fields: Record<string, unknown> = {
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

  const epicNameField = issueType.fieldsByName?.['Epic Name'];
  if (epicNameField) {
    fields[epicNameField.id] = summary;
  }

  if (epicIssue) {
    const epicLinkField = issueType.fieldsByName?.['Epic Link'] ?? issueType.fieldsByName?.['Parent'];
    if (epicLinkField?.schema?.type === 'any') {
      fields[epicLinkField.id] = epicIssue.key;
    } else if (fields.parent === undefined) {
      fields.parent = { key: epicIssue.key };
    }
  }

  const response = await jiraRequest<JiraIssue>('/issue', { method: 'POST', body: { fields } });
  return { ...response, summary, issueType: issueType.name };
}

export async function createSubtask({
  projectKey,
  issueType,
  parentIssue,
  summary,
  description,
  labels
}: {
  projectKey: string;
  issueType: JiraIssueType;
  parentIssue: JiraIssue;
  summary: string;
  description: string;
  labels?: string[];
}) {
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

export interface DemoIssues {
  allIssues: JiraIssue[];
  epic?: JiraIssue;
  plainStory?: JiraIssue;
  storyWithSubtasks?: JiraIssue & { subtasks?: JiraIssue[] };
  plainTask?: JiraIssue;
  taskWithSubtasks?: JiraIssue & { subtasks?: JiraIssue[] };
  plainBug?: JiraIssue;
  bugWithSubtasks?: JiraIssue & { subtasks?: JiraIssue[] };
}

export async function createDemoIssues(project: JiraProject, issueTypes: JiraIssueTypeMap): Promise<DemoIssues> {
  const results: DemoIssues = {
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

export interface JiraSandboxContext {
  project: JiraProject;
  issueTypes: JiraIssueTypeMap;
  issues: DemoIssues;
}

export class JiraTestSandbox {
  private project: JiraProject | null = null;

  private issueTypes: JiraIssueTypeMap | null = null;

  private issues: DemoIssues | null = null;

  constructor(private readonly options: { project?: CreateProjectOptions } = {}) {}

  async setup(): Promise<JiraSandboxContext> {
    this.project = await createProject(this.options.project);
    this.issueTypes = await getCreateMeta(this.project.key);
    this.issues = await createDemoIssues(this.project, this.issueTypes);
    return {
      project: this.project,
      issueTypes: this.issueTypes,
      issues: this.issues
    };
  }

  async teardown(): Promise<void> {
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

  async run<T>(callback: (context: JiraSandboxContext) => Promise<T>): Promise<T> {
    const context = await this.setup();
    try {
      return await callback(context);
    } finally {
      await this.teardown();
    }
  }
}

export async function withJiraTestProject<T>(
  callback: (context: JiraSandboxContext) => Promise<T>,
  options?: { project?: CreateProjectOptions }
) {
  const sandbox = new JiraTestSandbox(options);
  return sandbox.run(callback);
}
