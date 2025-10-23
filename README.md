# Gantt Horizon

Gantt Horizon is a Forge app being built under the Compass & Frame banner to turn Jira issues into reliable delivery plans. The project currently focuses on precise Modified PERT estimation and sequential aggregation so that schedule credibility is baked into the data model from the start. This document walks new contributors through the repository structure, the underlying concepts, and the day-to-day workflows.

## Repository layout

- `.gantt-horizon-version` – project-level semantic version (human managed, currently `0.2.0`).
- `AGENTS.md` – operational playbook: environment secrets, test commands, commit conventions.
- `docs/sample-press-release.md` – the “working backwards” artefact framing the product vision.
- `gantt-horizon/` – Forge app source.
  - `package.json`, `package-lock.json` – TypeScript toolchain wired for Forge UI Kit.
  - `tsconfig.json` – NodeNext ES module config with strict typing.
  - `src/`
    - `index.ts`, `resolvers/index.ts` – Forge runtime entry points.
    - `frontend/index.tsx` – UI Kit project-page surface.
    - `lib/` – reusable scheduling and Jira helpers.
      - `pertMath.ts` – Modified PERT primitives (validation, beta parameters, mean/variance).
      - `pertAggregation.ts` – sequential roll-up of child tasks using additive stats.
      - `pertTask.ts` – Jira helper to persist PERT triples on issues (stores both `(best, mostLikely, worst)` and `hours` aliases).
      - `jiraTestSandbox.ts` – creates disposable Jira projects/issues for integration tests.
  - `tests/` – Node test runner suites compiled to `dist/tests/*.test.js`.
    - `pert-aggregation.test.ts` – table-driven mean/variance expectations for 1..10 subtasks.
    - `pert-task.test.ts` – Jira-backed create/read tests for the PERT property helper.
    - `jira-sandbox.test.ts` – smoke test that the sandbox creates all baseline issue shapes.

## Concept primer

If you are new to PERT or deterministic scheduling:

1. **Modified PERT** – we treat each estimate triple `(best, mostLikely, worst)` as a beta distribution on `[a, b]` with weight `λ` (default 4). Means and variances are deterministic, allowing additive roll-ups.
2. **Sequential aggregation** – parent tasks sum child expectations and variances (`aggregateSequentialPert`). This models fully serial execution (critical-path fallbacks and parallel legs come later).
3. **Jira persistence** – leaf issues store the triple (and its hour aliases) in a Forge issue property so we can recompute aggregates or feed future UI surfaces without re-entering data.
4. **Sandbox** – tests create a throwaway Jira project with stories/tasks/bugs and sub-tasks so all hierarchy cases exist (plain, with children, etc.).

## Local setup

1. Install dependencies: `cd gantt-horizon && npm install`.
2. Populate secret helpers in the repo root (never commit these):
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

- `npm run build` – compiles TypeScript into `dist/` (Forge bundling still handles the UI/Resolver at deploy time, but tests consume the compiled output).
- `npm run test` – builds then executes `node --test dist/tests/**/*.test.js`. Integration suites auto-skip when Jira credentials are missing.
- `npm run lint` – currently wired for ESLint (UI Kit template default).

## Running tests explicitly

After exporting the credentials:

```bash
cd gantt-horizon
npm run build
node --test dist/tests/pert-aggregation.test.js
node --test dist/tests/pert-task.test.js
node --test dist/tests/jira-sandbox.test.js
```

Each test tears down any temporary project it creates; failures log the project key so you can clean up manually.

## Forge app structure

- **Frontend (`src/frontend/index.tsx`)** – still the starter UI Kit view, currently acting as a placeholder while backend services mature.
- **Resolvers (`src/resolvers/index.ts`)** – will host future scheduling APIs; for now it exposes a simple `getText` example for UI wiring.
- **Lib modules** – where the core value lives today:
  - `pertMath.ts` keeps the canonical math. Any change to Modified PERT assumptions happens here.
  - `pertAggregation.ts` handles parent summarisation and returns both mean and variance plus a `[min, max]` support useful for quick heuristics.
  - `pertTask.ts` is the integration point with Jira’s REST API. It validates inputs, creates a Task, and writes the estimate to an issue property using `jiraRequest`.
  - `jiraTestSandbox.ts` abstracts project creation, issue templating, and teardown so tests remain declarative.

## Versioning

- Forge still increments deployment majors automatically (`forge deploy`).
- Business-facing semantic version lives in `.gantt-horizon-version`; update it whenever you ship a meaningful milestone (current value: `0.2.0`).

## Future work hooks

- Parallel aggregation / critical-path calculations will extend the library (`pertAggregation.ts`).
- A dedicated data layer will promote PERT properties onto Epics/Stories automatically once resolvers call these helpers.
- README will evolve with UI features; today the focus is foundational scheduling math and test infrastructure.

## Getting help

- Read `AGENTS.md` for command snippets and conventions.
- Ping the Compass & Frame Slack channel (or Matt Halpern) when Jira credentials or environment secrets expire.
- The press release (`docs/sample-press-release.md`) is the product north star—refer to it when prioritising features.

Happy building!
