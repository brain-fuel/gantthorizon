# Gantt Horizon

Gantt Horizon is a Forge app being built under the Compass & Frame banner to turn Jira issues into reliable delivery plans. The project currently focuses on precise Modified PERT estimation and sequential aggregation so that schedule credibility is baked into the data model from the start. This document walks new contributors through the repository structure, the underlying concepts, and the day-to-day workflows.

## Repository layout

- `.gantt-horizon-version` – project-level semantic version (human managed, currently `0.2.1`).
- `AGENTS.md` – operational playbook: environment secrets, test commands, commit conventions.
- `docs/sample-press-release.md` – the “working backwards” artefact framing the product vision.
- `gantt-horizon/` – Forge app source.
  - `package.json`, `package-lock.json` – TypeScript toolchain wired for Forge UI Kit.
  - `tsconfig.json` – NodeNext ES module config with strict typing.
  - `src/`
    - `index.ts`, `resolvers/index.ts` – Forge runtime entry points.
    - `frontend/index.tsx` – UI Kit project-page surface.
    - `lib/` – reusable scheduling and Jira helpers (PERT math, aggregation, sandbox, etc.).
  - `tests/` – Node test runner suites compiled to `dist/tests/*.test.js`.

## Concept primer

1. **Modified PERT** – every estimate triple `(best, mostLikely, worst)` becomes a beta distribution on `[a, b]` with weight `λ`. Means and variances are deterministic, enabling additive roll-ups.
2. **Sequential aggregation** – parent tasks sum child expectations and variances (`aggregateSequentialPert`). Parallel legs and critical-path analysis come next.
3. **Jira persistence** – leaf issues store the triple (and hour aliases) in a Forge issue property so we can recompute aggregates or feed UI surfaces without re-entry.
4. **Sandbox** – tests create a throwaway Jira project with stories/tasks/bugs and sub-tasks so every hierarchy combination exists for assertions.

## Local setup

1. Install dependencies:
   ```bash
   cd gantt-horizon
   npm install
   ```
2. Populate secret helpers in the repo root (never commit them):
   ```bash
   echo 'you@example.com' > .atlassian-email
   echo 'api-token-value' > .atlassian-token
   echo 'your-site.atlassian.net' > .atlassian-jira-site
   ```
3. Export them when running commands that call Jira/Forge:
   ```bash
   export FORGE_EMAIL=$(cat .atlassian-email)
   export FORGE_API_TOKEN=$(cat .atlassian-token)
   export JIRA_SITE=$(cat .atlassian-jira-site)
   ```

## Key npm scripts (run from `gantt-horizon/`)

- `npm run build` – compiles TypeScript into `dist/` (tests consume the compiled output).
- `npm run test` – builds then executes `node --test dist/tests/**/*.test.js`. Integration suites auto-skip when credentials are missing.
- `npm run lint` – ESLint check (UI Kit template default).

## Running tests explicitly

```bash
cd gantt-horizon
npm run build
node --test dist/tests/pert-aggregation.test.js
node --test dist/tests/pert-task.test.js
node --test dist/tests/jira-sandbox.test.js
```

Each test tears down any temporary project it creates; failures log the project key so you can clean up manually.

## Deploying to the Forge development environment

1. Ensure Forge CLI is installed and you are logged in.
2. Export credentials:
   ```bash
   export FORGE_EMAIL=$(cat ../.atlassian-email)
   export FORGE_API_TOKEN=$(cat ../.atlassian-token)
   ```
3. (Optional) export your Jira site if commands reference it:
   ```bash
   export JIRA_SITE=$(cat ../.atlassian-jira-site)
   ```
4. Deploy the app to the development environment:
   ```bash
   cd gantt-horizon
   npm run build
   forge deploy --environment development --non-interactive
   ```
   `--no-verify` is available if linting blocks while TypeScript-only sources are in place.
5. Install (if not already installed):
   ```bash
   forge install --environment development --product jira --site <your-site>.atlassian.net --non-interactive --confirm-scopes
   ```

## Forge app structure

- **Frontend (`src/frontend/index.tsx`)** – currently a simple UI Kit page; will evolve into the scheduling dashboard.
- **Resolvers (`src/resolvers/index.ts`)** – Forge functions; currently a placeholder example for UI integration.
- **Lib modules** – core scheduling utilities, Jira integration, and sandbox support.

## Versioning

- Forge increments deployment majors automatically (`forge deploy`).
- Human semantic version lives in `.gantt-horizon-version`; update it whenever we ship a meaningful milestone (current value: `0.2.1`).

## Future work hooks

- Extend aggregation to handle parallel branches and critical-path calculations.
- Surface scheduling insights in UI Kit (Gantt view, probability bands).
- Implement issue-change triggers and recompute cadence for always-fresh timelines.

## Getting help

- Review `AGENTS.md` for day-to-day instructions.
- Reach out via Compass & Frame channels for credentials or process questions.
- Use `docs/sample-press-release.md` to orient features toward the product vision.

Happy building!
