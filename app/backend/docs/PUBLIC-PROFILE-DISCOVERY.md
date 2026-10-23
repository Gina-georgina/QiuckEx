# Public Profile Discovery Feature - Implementation Summary

## Overview
This document summarizes the implementation of the public profile discovery feature for QuickEx, enabling users to find public profiles via fuzzy search and discover trending creators based on transaction volume.

## Discovery Endpoints

All discovery endpoints are read-only, paginated with opaque cursors, and gated
behind feature flags. They share a common error contract and caching policy.

### Common Query Parameters

| Parameter | Type | Default | Range | Notes |
| --- | --- | --- | --- | --- |
| `limit` | integer | 10 | 1-100 | Page size |
| `cursor` | string | — | — | Opaque pagination cursor from a previous response |
| `query` | string | — | min 2 chars | Search term (search endpoint only) |
| `timeWindowHours` | integer | 24 | 1-720 | Ranking window (trending endpoint only) |

### Pagination Cursors

Responses include `nextCursor` (nullable) and `hasMore`. Cursors are opaque,
base64url-encoded, and encode the last-seen sort key plus a snapshot timestamp.
They are stable across pages and expire after 15 minutes; an expired or
malformed cursor returns `400`. Clients must not construct cursors themselves.

### Common Error Codes

| Status | Meaning | Retryable |
| --- | --- | --- |
| `400` | Malformed query, invalid `limit`/`cursor`, or invalid `timeWindowHours` | No |
| `429` | Rate limit exceeded (per-IP and per-key buckets) | Yes, after `Retry-After` |
| `503` | Dependency failure (database or cache unavailable) | Yes |

`429` responses include a `Retry-After` header. `503` responses are safe to
retry with backoff; discovery reads never mutate state.

### Caching TTLs

| Cache key | TTL | Invalidated by |
| --- | --- | --- |
| `profile:search:{queryHash}:{cursor}` | 60s | Metadata write, visibility toggle |
| `profile:trending:{window}:{cursor}` | 300s | Metadata write, visibility toggle |
| `profile:meta:{username}` / `profile:meta:{publicKey}` | 600s | Metadata write |

Reads are read-through: a miss falls back to the database and repopulates the
cache. If the cache backend is unavailable, reads fall through to the database
and the response includes `"cacheDegraded": true`.

### Feature-Flag Gating

| Flag | Gates | Default |
| --- | --- | --- |
| `PUBLIC_PROFILE_DISCOVERY` | All four discovery endpoints | off on mainnet |
| `USERNAME_RENAME_REDIRECTS` | Rename redirects + `resolve` | off on mainnet |
| `VERIFIED_PROFILE_METADATA` | Metadata read/write | off on mainnet |

When a flag is off, the gated endpoints return `404` (not `403`) so disabled
features are indistinguishable from non-existent routes.

### 1. Fuzzy Search for Public Usernames
**Endpoint:** `GET /username/search`

Allows users to search for public profiles using fuzzy matching with similarity scoring.

**Query Parameters:**
- `query` (required): Search term (minimum 2 characters)
- `limit` (optional): Maximum results (default: 10, range: 1-100)
- `cursor` (optional): Opaque pagination cursor

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "username": "alice",
      "publicKey": "GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWR",
      "similarityScore": 95,
      "lastActiveAt": "2025-03-27T10:00:00Z",
      "createdAt": "2025-02-19T08:00:00Z"
    }
  ],
  "profiles": [
    {
      "id": "uuid",
      "username": "alice",
      "publicKey": "GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWR",
      "similarityScore": 95,
      "lastActiveAt": "2025-03-27T10:00:00Z",
      "createdAt": "2025-02-19T08:00:00Z"
    }
  ],
  "total": 1,
  "nextCursor": null,
  "hasMore": false
}
```

`results` and `profiles` are the same array; `profiles` is retained as a
deprecated alias for older clients and will be removed in a future release.

**Search Algorithm:**
- **Primary:** PostgreSQL `pg_trgm` extension with `word_similarity()` for advanced trigram-based fuzzy matching
- **Fallback:** Pattern matching with intelligent similarity scoring when pg_trgm is unavailable
- Results sorted by similarity score (0-100) and activity timestamp

### 2. Trending Creators
**Endpoint:** `GET /username/trending`

Returns creator profiles ranked by recent transaction volume.

**Query Parameters:**
- `timeWindowHours` (optional): Time window in hours (default: 24, range: 1-720)
- `limit` (optional): Maximum creators (default: 10, range: 1-100)
- `cursor` (optional): Opaque pagination cursor

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "username": "toptrader",
      "publicKey": "GDXYZ...",
      "transactionVolume": 75000,
      "transactionCount": 200,
      "lastActiveAt": "2025-03-27T10:00:00Z",
      "createdAt": "2025-02-19T08:00:00Z"
    }
  ],
  "profiles": [
    {
      "id": "uuid",
      "username": "toptrader",
      "publicKey": "GDXYZ...",
      "transactionVolume": 75000,
      "transactionCount": 200,
      "lastActiveAt": "2025-03-27T10:00:00Z",
      "createdAt": "2025-02-19T08:00:00Z"
    }
  ],
  "timeWindowHours": 24,
  "calculatedAt": "2025-03-27T12:00:00Z",
  "nextCursor": null,
  "hasMore": false
}
```

**Ranking Algorithm:**
- Aggregates payment records from `payment_records` table
- Counts both sender and receiver activity
- Only includes profiles with "Public Profile" enabled
- Final score is a weighted sum of normalized signals:

| Signal | Weight | Notes |
| --- | --- | --- |
| USD transaction volume | 0.50 | Sum over the time window |
| Transaction count | 0.30 | Distinct payments, sender + receiver |
| Recency of last activity | 0.15 | Decays linearly over the window |
| Profile completeness | 0.05 | Verified metadata present |

- Ties are broken by `lastActiveAt` descending, then `username` ascending for
  deterministic pagination.

### 3. Toggle Public Profile Visibility
**Endpoint:** `POST /username/toggle-public`

Allows users to enable/disable their profile's visibility in public search and trending.

**Request Body:**
```json
{
  "username": "alice",
  "publicKey": "GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWR",
  "isPublic": true
}
```

**Response:**
```json
{
  "ok": true
}
```

**Security:**
- Only the wallet owner can toggle their profile visibility
- Ownership verification required before toggling

### 4. Username Rename Redirects

Renaming a username must never break existing payment links. Payment links are
resolved by username, so a rename has to leave a durable redirect from the old
username to the current one instead of silently 404-ing.

**Endpoint:** `POST /username/rename`

**Request Body:**
```json
{
  "currentUsername": "alice",
  "newUsername": "alice-pro",
  "publicKey": "GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWR"
}
```

**Response:**
```json
{
  "ok": true,
  "username": "alice-pro",
  "redirectFrom": "alice"
}
```

**Redirect resolution:** `GET /username/resolve/:username` returns the canonical
profile for a username, following at most one rename hop. Old links keep working
because the resolver maps the historical username to the current owner.

**Authorization:** Only the wallet that owns `currentUsername` may rename it;
ownership is verified against `publicKey` before any write.

**Validation:**
- `newUsername` must satisfy the same normalization/uniqueness rules as
  registration (lowercase, allowed charset, length bounds).
- `newUsername` must not already be taken by another wallet.
- `newUsername` must not collide with a reserved or previously-used username
  that is still an active redirect target.

**Idempotency:** Renames are keyed by `(publicKey, currentUsername, newUsername)`.
Replaying the same request returns the original result without creating a second
redirect or mutating state again.

**Rollback:** The rename and the redirect insert happen in a single transaction.
If the redirect cannot be written, the rename is rolled back so the old username
remains valid and no payment link is orphaned.

**Stable errors:**
- `400` malformed or invalid `newUsername`
- `401` missing/invalid ownership proof
- `403` `publicKey` does not own `currentUsername`
- `404` `currentUsername` not found
- `409` `newUsername` already taken or reserved
- `503` dependency failure (database unavailable) — safe to retry

**Observability:** Structured logs record `publicKey` (hashed), old and new
username, outcome, and latency. Metrics track rename success/failure counts,
redirect resolution hits/misses, and rename latency. No secrets or raw personal
data are logged.

**Feature gating:** Rename redirects are gated behind the
`USERNAME_RENAME_REDIRECTS` flag and are disabled on mainnet until the redirect
backfill migration has been verified on testnet.

### 5. Verified Profile Metadata with Cache Invalidation

Public profiles can carry **verified metadata** (display name, avatar URL, bio,
and social links) that is attested by the wallet owner. Verified metadata is
served from a read-through cache so discovery endpoints stay fast, and every
write invalidates the affected cache entries so stale metadata is never served.

**Endpoint:** `PUT /username/:username/metadata`

**Request Body:**
```json
{
  "publicKey": "GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWR",
  "displayName": "Alice",
  "avatarUrl": "https://cdn.quickex.example/avatars/alice.png",
  "bio": "Payments for indie makers",
  "links": ["https://alice.example", "https://x.com/alice"],
  "signature": "base64-ed25519-signature",
  "issuedAt": "2025-03-27T12:00:00Z",
  "expiresAt": "2025-03-27T12:05:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "username": "alice",
  "metadataVersion": 7,
  "verifiedAt": "2025-03-27T12:00:01Z"
}
```

**Verification (self-custody):** The wallet owner signs a canonical payload
(`username`, `metadataVersion`, `issuedAt`, `expiresAt`, and a hash of the
metadata fields) with their Stellar keypair. The backend verifies the signature
against the profile's `publicKey`; it never holds or derives private keys. A
metadata write is only accepted when the signature is valid and the payload has
not expired.

**Authorization:**
- `401` missing or malformed `signature`/`issuedAt`/`expiresAt`
- `403` signature does not verify against the profile's `publicKey`
- `404` `username` not found

**Validation:**
- `displayName` length 1-64, `bio` length 0-280, `avatarUrl` must be `https`
- `links` at most 5 entries, each an `https` URL
- `expiresAt` must be after `issuedAt` and within a 10-minute window
- `metadataVersion` must be strictly greater than the stored version

**Idempotency:** Writes are keyed by `(publicKey, username, metadataVersion)`.
Replaying the same version returns the original result without re-writing or
re-invalidating the cache. A lower or equal version is rejected with `409`.

**Cache invalidation:** Metadata is cached under `profile:meta:{username}` and
`profile:meta:{publicKey}`. On a successful write the service invalidates both
keys (and the discovery list keys `profile:search:*` / `profile:trending:*`)
inside the same transaction boundary, then repopulates lazily on the next read.
If invalidation fails the write is rolled back so the cache can never diverge
from the database.

**Degraded mode:** If the cache backend is unavailable, reads fall through to
the database and writes proceed with a logged `cache_degraded` warning; the
response includes `"cacheDegraded": true` so clients can retry later. Metadata
writes are never blocked by cache availability.

**Stable errors:**
- `400` malformed body or invalid metadata fields
- `401` missing/invalid signature envelope
- `403` signature does not match `publicKey`
- `404` `username` not found
- `409` stale `metadataVersion` (duplicate or out-of-order write)
- `410` expired signature envelope
- `503` dependency failure (database unavailable) — safe to retry

**Observability:** Structured logs record `publicKey` (hashed), `username`,
`metadataVersion`, outcome, and latency. Metrics track metadata write
success/failure counts, cache invalidation hits/misses, verification latency,
and degraded-mode activations. No secrets or raw personal data are logged.

**Feature gating:** Verified metadata is gated behind the
`VERIFIED_PROFILE_METADATA` flag and is disabled on mainnet until the metadata
migration and cache invalidation path have been verified on testnet.

### 6. Visibility Semantics

Visibility is a per-profile property that governs whether a profile appears in
discovery surfaces. It is deliberately narrow: it controls *discoverability*,
never *reachability*.

**What visibility controls:**
- Whether the profile is returned by `GET /username/search`
- Whether the profile is returned by `GET /username/trending`
- Whether the profile's verified metadata is exposed on discovery responses

**What visibility does NOT control:**
- Direct payment links. `GET /username/resolve/:username` resolves a username
  regardless of `is_public`, so a private profile can still receive payments.
- Rename redirects. Redirects are resolved independently of visibility.
- Ownership or authorization. A private profile is still owned by its wallet and
  can be renamed, toggled, or have its metadata written.

**States:**
- `is_public = false` (default): hidden from search and trending; resolvable and
  payable.
- `is_public = true`: eligible for search and trending, subject to the ranking
  and similarity thresholds below.

**Transition rules:**
- Toggling is idempotent: setting `isPublic` to its current value is a no-op and
  returns `{ "ok": true }`.
- Toggling to `false` takes effect immediately for subsequent reads. Cached
  discovery entries (`profile:search:*`, `profile:trending:*`) are invalidated
  on the same transaction boundary so a hidden profile is not served from cache.
- Toggling to `true` does not retroactively backfill historical activity;
  trending only counts activity inside the requested `timeWindowHours`.
- A profile that is not public is excluded from trending even if it has the
  highest transaction volume in the window.

**Stable errors:**
- `400` malformed body or missing `isPublic`
- `401` missing/invalid ownership proof
- `403` `publicKey` does not own `username`
- `404` `username` not found
- `503` dependency failure (database unavailable) — safe to retry

### 7. Key Rotation Lifecycle

A profile's `publicKey` may rotate (for example after key compromise or routine
custody migration). Rotation is a four-phase lifecycle: **announce**, **grace
period**, **revoke**, and **replay protection**. Every phase is signed by the
key that is currently authoritative, so a rotation can never be driven by an
unauthenticated caller.

**Phase 1 — Announce.** The owner signs a rotation announcement with the *old*
key, authorizing the *new* key. The announcement is written to
`profile_key_rotations` and the new key is recorded as `pending`. During this
phase the old key remains authoritative for all writes; the new key cannot yet
sign metadata or renames.

**Phase 2 — Grace period.** Both keys are accepted for a bounded window
(default 24h, configurable via `PROFILE_KEY_ROTATION_GRACE_HOURS`). The old key
may still sign metadata writes and renames; the new key may also sign them. This
lets clients holding either key continue to operate while they migrate. The
grace window is recorded as `grace_expires_at` on the rotation row.

**Phase 3 — Revoke.** Once the grace window elapses (or the owner explicitly
finalizes), the old key is revoked: it is removed from the accepted-signer set
and any subsequent write signed with it is rejected with `403`. The new key
becomes the sole authoritative signer. Revocation is monotonic — a revoked key
cannot be reinstated by replaying an earlier announcement.

**Phase 4 — Replay protection.** Every rotation carries a monotonically
increasing `rotationVersion` and a unique `rotationId`. Writes are keyed by
`(publicKey, rotationVersion, rotationId)`:
- Replaying an announcement that has already been applied returns the original
  result without mutating state.
- A `rotationVersion` lower than or equal to the stored version is rejected with
  `409`.
- A signature envelope whose `expiresAt` has passed is rejected with `410`.
- Announcements are single-use: once a rotation is finalized, the same
  `rotationId` cannot start a new rotation.

**Atomicity:** Announce, finalize, and revoke each happen in a single
transaction. If the rotation row cannot be written, the key state is left
unchanged so a profile is never left without an authoritative signer.

**Stable errors:**
- `400` malformed body or invalid rotation fields
- `401` missing/invalid signature envelope
- `403` signature does not match the currently authoritative key
- `404` `username` not found
- `409` stale `rotationVersion` or already-used `rotationId`
- `410` expired signature envelope or grace window elapsed for the old key
- `503` dependency failure (database unavailable) — safe to retry

**Observability:** Structured logs record `publicKey` (hashed), `username`,
`rotationId`, `rotationVersion`, phase, outcome, and latency. Metrics track
rotation announce/finalize/revoke counts, grace-period activations, replay
rejections, and rotation latency. No secrets or raw personal data are logged.

**Feature gating:** Key rotation is gated behind the `PROFILE_KEY_ROTATION`
flag and is disabled on mainnet until the rotation migration and grace-period
handling have been verified on testnet.

## Database Changes

### Migration 1: `20250327000000_add_username_visibility.sql`
Added columns to `usernames` table:
- `is_public` (BOOLEAN): Controls profile visibility (defaults to false)
- `last_active_at` (TIMESTAMPTZ): Tracks user activity for trending

**Indexes Created:**
- `usernames_is_public_idx`: Partial index for fast public profile filtering
- `usernames_last_active_at_idx`: Activity-based sorting
- `usernames_public_active_idx`: Composite index for public profiles by activity

### Migration 2: `20250327000001_add_fuzzy_search_function.sql`
PostgreSQL function for optimized fuzzy search:
- Enables `pg_trgm` extension
- Creates `search_usernames(query, limit)` function
- GIN index on trigram ops for performance
- Returns results with similarity scores (0-100)

### Migration 3: `20250327000002_add_username_rename_redirects.sql`
Adds durable redirects for renamed usernames:
- `username_redirects` table: `old_username` (PK), `current_username`,
  `public_key`, `created_at`
- Unique index on `old_username` to guarantee a single canonical target
- Foreign key from `current_username` to `usernames.username`
- Backfill is a no-op for existing rows; redirects are created only on rename

### Migration 4: `20250327000003_add_verified_profile_metadata.sql`
Adds verified metadata storage for public profiles:
- `profile_metadata` table: `username` (PK, FK to `usernames.username`),
  `public_key`, `display_name`, `avatar_url`, `bio`, `links` (JSONB),
  `metadata_version` (BIGINT), `verified_at`, `updated_at`
- Unique index on `(public_key, metadata_version)` to enforce idempotent writes
- `metadata_version` starts at 1 and increments on each accepted write
- Backfill is a no-op; rows are created only on the first verified write

### Migration 5: `20250327000004_add_profile_key_rotations.sql`
Adds the key-rotation lifecycle state for public profiles:
- `profile_key_rotations` table: `rotation_id` (PK), `username` (FK to
  `usernames.username`), `old_public_key`, `new_public_key`, `rotation_version`
  (BIGINT), `phase` (`announced` | `grace` | `revoked`), `announced_at`,
  `grace_expires_at`, `revoked_at`
- Unique index on `(username, rotation_version)` to enforce monotonic versions
- Unique index on `rotation_id` to make announcements single-use
- Partial index on `phase` for pending rotations to keep finalize/revoke scans
  cheap
- Backfill is a no-op; rows are created only on the first announcement

## Architecture

### DTOs Created
Located in `src/dto/username/`:
- `SearchUsernamesQueryDto`: Search query validation
- `SearchUsernamesResponseDto`: Search response structure
- `PublicProfileDto`: Common profile representation
- `TrendingCreatorsQueryDto`: Trending query parameters
- `TrendingCreatorsResponseDto`: Trending response structure
- `RenameUsernameDto`: Rename request validation
- `RenameUsernameResponseDto`: Rename response structure
- `UpdateProfileMetadataDto`: Verified metadata write validation
- `UpdateProfileMetadataResponseDto`: Verified metadata write response

### Service Layer Updates

#### `UsernamesService`
New methods:
- `searchPublicUsernames(query, limit)`: Fuzzy search with validation
- `getTrendingCreators(timeWindowHours, limit)`: Trending calculation
- `togglePublicProfile(username, publicKey, isPublic)`: Visibility control
- `renameUsername(currentUsername, newUsername, publicKey)`: Transactional rename
  with redirect creation and idempotency
- `resolveUsername(username)`: Follows at most one rename hop to the canonical profile
- `updateVerifiedMetadata(username, dto)`: Verifies the owner signature, enforces
  monotonic `metadataVersion`, writes metadata, and invalidates cache entries
- `getVerifiedMetadata(username)`: Read-through cache lookup with database fallback
- `announceKeyRotation(username, dto)`: Records a signed rotation announcement and
  moves the profile into the grace period
- `finalizeKeyRotation(username, dto)`: Revokes the old key once the grace window
  elapses or the owner explicitly finalizes
- `resolveAuthoritativeKey(username)`: Returns the currently accepted signer set
  (old key during grace, new key after revoke)

#### `SupabaseService`
New methods:
- `searchPublicUsernames(query, limit)`: Database search with fallback
- `getTrendingCreators(timeWindowHours, limit)`: Volume aggregation
- `updateUsernameActivity(username)`: Activity timestamp update
- `togglePublicProfile(username, isPublic)`: Visibility toggle
- `renameUsernameWithRedirect(...)`: Atomic rename + redirect insert
- `resolveUsernameRedirect(username)`: Redirect lookup
- `upsertProfileMetadata(...)`: Atomic metadata write with version guard
- `getProfileMetadata(username)`: Metadata read for cache population
- `insertKeyRotation(...)`: Atomic rotation announcement with version guard
- `finalizeKeyRotation(...)`: Atomic revoke of the old key
- `getActiveKeyRotation(username)`: Rotation state lookup for signer resolution

### Controller Updates
`UsernamesController` now exposes:
- `GET /username/search`: Public profile search
- `GET /username/trending`: Trending creators
- `POST /username/toggle-public`: Visibility toggle
- `POST /username/rename`: Rename with redirect
- `GET /username/resolve/:username`: Canonical resolution for payment links
- `PUT /username/:username/metadata`: Verified metadata write with cache invalidation
- `GET /username/:username/metadata`: Verified metadata read (cache-backed)
- `POST /username/:username/rotate-key`: Announce a key rotation
- `POST /username/:username/rotate-key/finalize`: Revoke the old key after grace

All endpoints include:
- Swagger/OpenAPI documentation
- Input validation
- Stable error codes for unauthorized, duplicate, expired, malformed, and
  dependency-failure cases
- Structured logging and metrics without secrets or raw personal data
