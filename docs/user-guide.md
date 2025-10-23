# Gantt Horizon User Guide

_Last updated for version 0.4.0_

Welcome to **Gantt Horizon**, the Compass & Frame Forge app that keeps Jira delivery plans trustworthy. This guide explains how to install the app, capture PERT estimates, and read the resulting schedules. It will evolve alongside the product—check the version stamp above to confirm you have the latest instructions.

## 1. Prerequisites

- You need an Atlassian cloud site (Jira Software) where you are an administrator.
- Forge app installation requires an Atlassian API token. Follow [Atlassian’s guide](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) to create one if needed.
- Ensure the Forge CLI is installed and you can authenticate (`forge login`).

## 2. Install the app

1. From your local clone, deploy the latest build to the development environment:
   ```bash
   cd gantt-horizon
   npm run build
   forge deploy --environment development --non-interactive
   ```
2. Install the app onto your Jira site:
   ```bash
   forge install --environment development --product jira --site <your-site>.atlassian.net --non-interactive --confirm-scopes
   ```
3. After installation, open any project (company-managed recommended) and navigate to the **Apps** panel to launch **Gantt Horizon**.

## 3. Capture PERT estimates on tasks

- Create or open a Jira issue of type Task, Story, or Bug.
- Use the “PERT Estimates” fields (best-case, most-likely, worst-case) exposed by the app UI or REST helpers.
- Enter estimates in hours. Gantt Horizon enforces the rule `best ≤ mostLikely ≤ worst`; invalid combinations are rejected.
- Save the issue. The app stores your inputs as a Forge issue property that downstream aggregations read automatically.

## 4. Understand sequential roll-ups

- Parent issues (e.g., a Story containing subtasks) display aggregated metrics derived from children:
  - **Expected duration** (Modified PERT mean).
  - **Variance / standard deviation** (uncertainty measure).
  - **Support** (min/max bounds derived from the best and worst extremes).
- Roll-ups assume sequential execution in this MVP. Parallel path modelling and critical-path insights are planned enhancements.

## 5. Dashboard view (coming soon)

The current UI Kit panel shows scaffolding content while backend services mature. Upcoming releases will surface:
- Confidence bands (e.g., 50% vs 90% completion prospects).
- Highlighted critical tasks (longest expected path).
- Resource load indicators.

## 6. Troubleshooting

| Situation | Resolution |
|-----------|------------|
| App panel missing | Ensure the app is installed for the current project. Re-run the `forge install` command if needed.
| Estimates rejected | Verify the numeric ordering `best ≤ mostLikely ≤ worst` and that all values are non-negative.
| Aggregates don’t refresh | Issue updates trigger calculations, but you can redeploy the app or run `forge deploy` to ensure the latest logic is active. A recompute cadence feature is on the roadmap.
| Old documentation | Check the version stamp at the top of this page and update from the repository main branch if it doesn’t match `.gantt-horizon-version`.

## 7. Getting help

- Contact the Compass & Frame maintainers via the usual support channel or email listed in the press release.
- Reference `docs/sample-press-release.md` for the product vision and upcoming milestones.
- Developers can consult `README.md` and `AGENTS.md` for build/test instructions.

_This guide is maintained alongside the codebase. Please update it whenever behaviour or UI flows change._
