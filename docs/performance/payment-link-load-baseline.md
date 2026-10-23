# Payment-link creation load baseline

Script: `app/backend/test/load/payment-link-creation.js` (k6). Issue #473.

## Profile

| Phase | Executor | Load | Duration |
|-------|----------|------|----------|
| Ramp | `ramping-vus` | 0 → 50 VUs | 2 min |
| Sustained | `constant-arrival-rate` | 100 req/s | 2 min |

## Gates (fail the RC)

- `http_req_duration` p95 < 500 ms
- `http_req_failed` rate < 1%

## Running

```bash
# Local
k6 run app/backend/test/load/payment-link-creation.js

# Staging
BASE_URL=https://<staging-api> API_KEY=<key> k6 run app/backend/test/load/payment-link-creation.js
```

In CI the test runs only in the **Release Candidate Validation** workflow
(`rc-validate.yml`, `load-test` job) against `secrets.STAGING_API_URL`; it does
not run on pull requests.

## Baseline

Record each RC run's summary here (copy from the `k6-summary` artifact).

| Date | Ref | p50 (ms) | p95 (ms) | p99 (ms) | Throughput (req/s) | Error rate |
|------|-----|----------|----------|----------|--------------------|------------|
| _pending first staging run_ | | | | | | |
