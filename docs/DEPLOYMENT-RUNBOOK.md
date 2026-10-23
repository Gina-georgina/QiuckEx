# Backend Deployment Runbook

## Blue-Green Production Rollout

The production CD workflow builds and scans the backend image, validates the
release candidate, deploys the image to the inactive slot, and waits for
`GET /health/ready` to return HTTP 200 before asking the traffic controller to
send production traffic to that slot. The active slot remains unchanged until
that readiness check passes. A deployment, readiness, or traffic-switch
failure fails the workflow and triggers a request to restore the previously
active slot.

### Required GitHub configuration

Configure these repository variables and secret before enabling production CD:

| Name | Type | Purpose |
| --- | --- | --- |
| `PRODUCTION_BLUE_URL` | Variable | HTTPS base URL of the blue deployment slot. |
| `PRODUCTION_GREEN_URL` | Variable | HTTPS base URL of the green deployment slot. |
| `PRODUCTION_TRAFFIC_CONTROLLER_URL` | Variable | Base URL of the authenticated traffic controller. |
| `PRODUCTION_DEPLOY_TOKEN` | Secret | Bearer token accepted by the deploy and traffic-controller endpoints. |

Blue and green URLs must identify distinct deployment slots, and all three
URLs must use HTTPS because the workflow sends a bearer token. Both deployment
slots must accept `POST /_deploy` with a JSON body containing `image`, `sha`,
`environment`, and `slot`, and serve the deployed image at `/health/ready`. The
traffic controller must expose `GET /active`, returning `{"target":"blue"}` or
`{"target":"green"}`, and accept `POST /switch` with
`{ "target": "green", "sha": "..." }` to promote green or
`{ "target": "blue" }` to restore blue. Both endpoints must accept the bearer
token above and return a successful response only after the operation is
complete. The workflow reads the active slot and always deploys to the other
slot, so subsequent releases alternate between blue and green. Keep the active
slot running until the replacement has passed readiness checks and traffic has
been switched successfully.

The repository does not provision a load balancer or traffic controller. The
platform operator must implement and validate this endpoint contract before
setting the production configuration. Until then, the CD job fails closed at
configuration validation instead of reporting a deployment as successful.

### Failure and rollback

If deployment or readiness fails, traffic is not promoted away from the
currently active slot. If the traffic switch fails or is interrupted, the
workflow requests a switch back to the previously active slot and reports
failure in the GitHub Actions run. Confirm the active target in the platform
control plane before retrying. Do not stop or remove either slot until the
rollback or promotion is verified.

If a database migration fails or needs to be reverted after a failed rollout,
run `./scripts/rollback-migration.sh --dry-run` followed by
`./scripts/rollback-migration.sh --yes` against the target environment. See
[MIGRATION-RUNBOOK.md](./MIGRATION-RUNBOOK.md) for the complete database
rollback procedure.

### Operational verification

After promotion, verify that the traffic controller reports the newly promoted
slot as active, the production `/health/ready` endpoint returns HTTP 200, and
backend error and payment-flow metrics remain normal. Run a concurrent load
test through a staging rollout before relying on zero-downtime behavior; do not
use production payment traffic as a deployment test.