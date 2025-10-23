# Instructions for Agents

Never commit .atlassian-email
Never commit .atlassian-token
Never commit .atlassian-jira-site

As needed, repopulate the necessary environment variables by running:

```bash
export FORGE_EMAIL=$(cat .atlassian-email)
export FORGE_API_TOKEN=$(cat .atlassian-token)
export JIRA_SITE=$(cat .atlassian-jira-site)
```

If I need to repopulate .atlassian-token because it is out of date, let me know.

Follow the Commit Standards in standards/CONVENTIONAL_COMMITS.md

## Active Forge apps

- `hello-world-app`: initial tutorial scaffold, keep for reference only.
- `gantt-horizon`: primary project for incremental feature work. Build new functionality here.

## Versioning

- Track app releases in `.gantt-horizon-version` using [Semantic Versioning 2.0.0](standards/SEMVER.md).
- Forge deploys still increment major versions automatically; keep the semantic version file in sync with feature milestones.

## Testing

- Set `JIRA_SITE`, `FORGE_EMAIL`, and `FORGE_API_TOKEN` in your shell session (use the snippet above to populate them from `.atlassian-*` helper files) before running Jira integration tests.
- Change into `gantt-horizon/` and run `npm run test` for a full build plus the TypeScript unit suite (integration tests will be skipped when Atlassian credentials are not exported).
- After exporting `FORGE_EMAIL`, `FORGE_API_TOKEN`, and `JIRA_SITE`, execute `node --test dist/tests/jira-sandbox.test.js` to generate a temporary project, populate coverage issues, and verify teardown.
- Run `node --test dist/tests/pert-task.test.js` for the PERT task creation assertions.
- Run `node --test dist/tests/pert-aggregation.test.js` to validate sequential aggregation scenarios on the compiled output.
