# Gantt Horizon

Gantt Horizon is a Forge app under the Compass & Frame banner that turns Jira issues into reliable delivery plans. The current focus is Modified PERT estimation and sequential aggregation, laying the mathematical groundwork for critical-path scheduling. This guide orients new developers on the structure, theory, and workflows.

## Repository layout

- `.gantt-horizon-version` – semantic version for stakeholders (currently `0.3.0`).
- `AGENTS.md` – operational instructions, secrets handling, testing commands, commit rules.
- `docs/sample-press-release.md` – working-backwards press release for the product vision.
- `gantt-horizon/` – Forge app source.
  - `package.json`, `package-lock.json` – TypeScript / Forge CLI toolchain.
  - `tsconfig.json` – NodeNext compiler settings.
  - `src/`
    - `index.ts`, `resolvers/index.ts` – Forge backend entry.
    - `frontend/index.tsx` – UI Kit project page (currently a placeholder view).
    - `lib/` – PERT math, aggregation, Jira automation helpers.
  - `tests/` – Node test suites (built output lives in `dist/tests`).

## Concept primer

1. **Modified PERT** – estimate triples `(best, mostLikely, worst)` map to Beta distributions with weight `λ` (default 4). Means and variances are deterministic.
2. **Sequential aggregation** – parent durations sum child expectations/variances (`aggregateSequentialPert`). Parallel handling and critical-path scoring will follow.
3. **Persistence in Jira** – when we create a task via `createPertTask`, we store the triple (plus hour aliases) as an issue property so resolvers/UI can reuse the values.
4. **Sandboxing** – `jiraTestSandbox` spins up temporary projects with stories/tasks/bugs & subtasks so tests can validate every hierarchy scenario before teardown.

## Local setup

1. Install dependencies:
   ```bash
   cd gantt-horizon
   npm install
   ```
2. Seed helper files (never commit them):
   ```bash
   echo 'you@example.com' > .atlassian-email
   echo 'api-token-value' > .atlassian-token
   echo 'your-site.atlassian.net' > .atlassian-jira-site
   ```
3. Export secrets when running commands that contact Jira or Forge:
   ```bash
   export FORGE_EMAIL=$(cat .atlassian-email)
   export FORGE_API_TOKEN=$(cat .atlassian-token)
   export JIRA_SITE=$(cat .atlassian-jira-site)
   ```

## Key npm scripts

- `npm run build` – compile TypeScript to `dist/` (tests consume compiled JS; Forge bundler still handles runtime packaging).
- `npm run test` – build then execute `node --test dist/tests/**/*.test.js`. Integration tests auto-skip without credentials.
- `npm run lint` – ESLint (UI Kit default).

## Running tests manually

```bash
cd gantt-horizon
npm run build
node --test dist/tests/pert-aggregation.test.js
node --test dist/tests/pert-task.test.js
node --test dist/tests/jira-sandbox.test.js
```

Temporary Jira projects are deleted in teardown; if a test fails it prints the project key for manual cleanup.

## Deploying to the Forge development environment

1. Install Forge CLI and log in (`forge login`).
2. Export secrets (see Local setup step 3).
3. Build the project:
   ```bash
   cd gantt-horizon
   npm run build
   ```
4. Deploy to the development environment:
   ```bash
   forge deploy --environment development --non-interactive
   ```
   Add `--no-verify` if ESLint blocks due to TypeScript-only sources.
5. Install if needed:
   ```bash
   forge install --environment development --product jira --site <site>.atlassian.net --non-interactive --confirm-scopes
   ```

## Forge app structure (highlights)

- `src/frontend/index.tsx` – UI Kit view (to-be replaced by scheduling dashboard).
- `src/resolvers/index.ts` – Forge backend (currently sample resolver).
- `src/lib/` –
  - `pertMath.ts` – Validates triples, computes Modified PERT beta parameters, mean, variance.
  - `pertAggregation.ts` – Sequential roll-up summary (mean, variance, support).
  - `pertTask.ts` – Creates Jira tasks with PERT properties, exposes `getPertEstimate`.
  - `jiraTestSandbox.ts` – Creates test projects/issues, handles teardown.

## Versioning

- Forge increments deployment majors automatically (`forge deploy`).
- Project semantic version is managed in `.gantt-horizon-version` (currently `0.3.0`). Update it whenever behaviour changes significantly.

## Future work

- Parallel aggregation & critical path calculations.
- UI surfaces for schedule confidence and critical tasks.
- Event triggers & scheduled recompute cadence.

## Getting help

- See `AGENTS.md` for operational instructions.
- Contact Compass & Frame maintainers when credentials or Forge access need attention.
- Align features with the press release in `docs/sample-press-release.md`.

Happy building!
