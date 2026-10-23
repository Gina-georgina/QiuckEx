# Staging Previews

This document describes the staging preview system: how previews are triggered, how they are scoped, the lifecycle of a preview deployment, and the guardrails that keep previews isolated from production.

## Overview

Staging previews provide an ephemeral, fully isolated environment for every pull request. Each preview gets its own deterministic scope id, its own set of deployed resources, and its own runtime configuration. Previews are deployed to **testnet only** — production networks are never touched by the preview pipeline.

Every pull request receives two preview deployments:

- **Frontend** — a Vercel preview deployment with a unique URL per PR.
- **Backend** — a separate staging service namespaced by the PR's scope id.

## Triggers

A staging preview is created or updated when:

- A pull request is **opened** against the default branch.
- A pull request is **synchronized** (new commits pushed) while open.
- A pull request is **reopened** after being closed.

A staging preview is torn down when:

- The pull request is **closed** (whether merged or not).

Previews are not created for draft pull requests unless the `preview` label is applied. Removing the `preview` label from a draft pull request tears the preview down.

## The `preview` GitHub Environment

All preview jobs run inside the `preview` GitHub environment. This environment holds the secrets and variables required to deploy and operate a preview:

| Name | Type | Purpose |
| --- | --- | --- |
| `PREVIEW_DEPLOY_TOKEN` | Secret | Token used to deploy preview resources. |
| `PREVIEW_MIGRATE_TOKEN` | Secret | Token used to run migrations against the preview database. |
| `PREVIEW_SMOKE_TOKEN` | Secret | Token used by the smoke-test suite. |
| `PREVIEW_TEARDOWN_TOKEN` | Secret | Token used to destroy preview resources. |
| `VERCEL_TOKEN` | Secret | Token used to create Vercel preview deployments. |
| `PREVIEW_NETWORK` | Variable | Network the preview targets. Must be a testnet. |
| `PREVIEW_BASE_DOMAIN` | Variable | Base domain under which preview URLs are published. |

The environment is configured with required reviewers disabled for automated runs, but it is protected by branch rules so that only the default branch's workflow definitions can use it.

## Deterministic Scope Id Derivation

Every preview is identified by a **scope id** that is derived deterministically from the pull request. The derivation is:

```
scope_id = "pr-" + <pull_request_number>
```

The scope id is used to:

- Namespace all deployed resources (databases, buckets, services, DNS records).
- Key the preview's runtime configuration.
- Tag the PR comment so it can be updated in place rather than duplicated.

Because the scope id is a pure function of the pull request number, re-running the pipeline for the same PR always targets the same resources. This makes previews idempotent: a re-run updates the existing preview rather than creating a second one. The scope id also guarantees the preview URL is unique per PR.

## Lifecycle

Each preview follows a four-phase lifecycle. Phases run in order; a failure in an earlier phase aborts the later phases.

### 1. Deploy

The deploy phase provisions the preview's infrastructure and application:

- Resolves the scope id from the pull request number.
- Applies the preview runtime configuration (see [RUNTIME-CONFIG-MATRIX.md](./RUNTIME-CONFIG-MATRIX.md) for the full env var list).
- Deploys the frontend as a Vercel preview deployment and the backend as a separate staging service into the scope.
- Publishes the preview URLs under `PREVIEW_BASE_DOMAIN`.

### 2. Migrate

The migrate phase brings the preview database schema up to date:

- Connects to the preview database using the scope id.
- Runs pending migrations.
- Fails the pipeline if any migration errors, leaving the preview in a non-ready state.

### 3. Smoke Test

The smoke-test phase verifies the preview is functional:

- Runs the smoke-test suite against the published preview URL.
- Exercises the critical paths (health check, authentication, primary read/write flows).
- Reports results back to the pull request.

### 4. Teardown

The teardown phase destroys the preview:

- Triggered when the pull request is closed.
- Removes all resources namespaced by the scope id.
- Deletes the preview's runtime configuration.
- Marks the PR comment as torn down.

Teardown is best-effort and idempotent: running it against an already-torn-down preview is a no-op.

## PR Comment Behaviour

The pipeline maintains a single comment on the pull request, identified by a hidden marker. On each run it updates the existing comment rather than posting a new one.

The comment reports:

- The current lifecycle phase and its status (pending, running, succeeded, failed).
- The frontend and backend preview URLs once the deploy phase completes.
- The result of the basic health check, migrate, and smoke-test phases.
- A teardown notice when the preview is destroyed.

If a phase fails, the comment surfaces the failure and links to the failing job's logs.

## Testnet-Only Enforcement

Previews are restricted to testnets. The pipeline enforces this in two places:

1. **Configuration validation** — `PREVIEW_NETWORK` is validated against an allowlist of testnet identifiers. A non-testnet value fails the pipeline before any resources are provisioned.
2. **Runtime guard** — the deploy and migrate phases assert the resolved network is a testnet before performing any mutating operation.

In addition, the workflow sets `STELLAR_NETWORK=testnet` for every preview job and fails fast if the value is anything else. Mainnet feature flags are blocked: the workflow rejects any `*_MAINNET*` feature flag being enabled in the preview configuration.

This ensures a misconfigured preview can never deploy to, migrate, or smoke-test against a production network.

## Runtime Configuration

The full list of environment variables available to a preview — including which are required, their defaults, and their scope — is documented in [RUNTIME-CONFIG-MATRIX.md](./RUNTIME-CONFIG-MATRIX.md). Consult that matrix when adding or changing preview configuration; this document only covers the preview-specific mechanics.