# API Compatibility Baseline

This directory contains the frozen OpenAPI document for the **previous release** of the API. It is used by the API compatibility check to detect breaking changes between the current working tree and the last shipped version.

## Contents

- `openapi.json` — the OpenAPI document exported from the previous release. This is a checked-in artifact and must not be edited by hand.

## How the baseline is generated

The baseline is produced by exporting the OpenAPI document from the codebase at the previous release tag:

```bash
# From the repository root, check out the previous release tag
git checkout v<previous-release>

# Install dependencies and export the OpenAPI document
npm ci
npx ts-node scripts/export-openapi.ts > app/backend/src/api-compatibility/baseline/openapi.json

# Return to your working branch
git checkout -
```

The `scripts/export-openapi.ts` script builds the application's OpenAPI specification from the registered routes and schemas and writes it to stdout, so it can be redirected into the baseline file.

## How the baseline is refreshed

The baseline is refreshed **once per release**, as part of the release process:

1. Cut the new release and tag it (e.g. `v<new-release>`).
2. Run the export command above against the newly tagged release.
3. Commit the updated `openapi.json` to the main branch.
4. The compatibility check will now compare future changes against this new baseline.

Do not refresh the baseline outside of a release, and never hand-edit `openapi.json`. Any change to the baseline should come from a real export of a released version so that the compatibility check reflects actual shipped behavior.

## How it is used

The API compatibility check compares the OpenAPI document generated from the current working tree against `openapi.json` in this directory. Differences that remove or change existing endpoints, parameters, request bodies, or response schemas are reported as breaking changes and will fail the check.