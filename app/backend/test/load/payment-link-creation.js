/**
 * k6 load test — payment-link creation (Issue #473).
 *
 * Usage:
 *   BASE_URL=https://staging.api.quickex.to k6 run app/backend/test/load/payment-link-creation.js
 *
 * Env:
 *   BASE_URL   Target API origin (default http://localhost:4000)
 *   LINK_PATH  Creation endpoint path (default /links/metadata)
 *   API_KEY    Optional API key sent as x-api-key
 *
 * Profile: ramp to 50 VUs over 2 min, then hold ~100 req/s.
 * Thresholds fail the run (non-zero exit) if p95 >= 500 ms or errors >= 1%.
 * Baseline numbers are recorded in docs/performance/payment-link-load-baseline.md.
 */
import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const LINK_PATH = __ENV.LINK_PATH || "/links/metadata";
const API_KEY = __ENV.API_KEY || "";

export const errorRate = new Rate("payment_link_errors");

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [{ duration: "2m", target: 50 }],
      gracefulRampDown: "10s",
    },
    sustained: {
      executor: "constant-arrival-rate",
      startTime: "2m",
      rate: 100,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    payment_link_errors: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const ASSETS = ["XLM", "USDC"];

export default function () {
  const payload = JSON.stringify({
    amount: Number((Math.random() * 500 + 1).toFixed(2)),
    asset: ASSETS[Math.floor(Math.random() * ASSETS.length)],
    memo: `load-${__VU}-${__ITER}`,
    expirationDays: 7,
  });

  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = http.post(`${BASE_URL}${LINK_PATH}`, payload, {
    headers,
    tags: { endpoint: "payment-link-create" },
  });

  const ok = check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(!ok);
}
