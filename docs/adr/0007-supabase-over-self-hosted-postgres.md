# 0007 — Use Supabase over self-hosted Postgres

- **Status:** Proposed
- **Date:** 2024-01-01
- **Deciders:** Maintainers
- **Related:** [0003 — Supabase as system of record](./0003-supabase-as-system-of-record.md)

## Context

The project needs a relational database as its system of record. The data model is
relational (users, organizations, records with foreign keys), and the application
already relies on Postgres semantics. We had to choose between running Postgres
ourselves (self-hosted or on a generic VM/container platform) and using a managed
platform such as Supabase.

Self-hosting Postgres means we own provisioning, backups, upgrades, connection
pooling, TLS, monitoring, and on-call for the database. Supabase provides managed
Postgres plus first-class features we depend on: Row Level Security (RLS) policies
enforced at the database layer, realtime subscriptions, and an auth layer that
integrates with RLS.

ADR [0003](./0003-supabase-as-system-of-record.md) established Supabase as the
system of record. This ADR records the specific decision to use Supabase rather
than self-hosted Postgres, so future contributors understand the constraints.

## Decision

We use Supabase as our managed Postgres provider. The database is Postgres, but
the application may rely on Supabase-specific capabilities:

- **Row Level Security (RLS)** policies as the primary authorization boundary.
- **Realtime** subscriptions for live updates.
- **Supabase Auth** integration with RLS via `auth.uid()` and related helpers.
- Supabase client libraries and connection conventions.

Contributors must not introduce changes that assume a plain self-hosted Postgres
(e.g. bypassing RLS with a superuser connection, or replacing Supabase auth
helpers with ad-hoc session handling).

## Consequences

### Positive

- No operational burden for backups, upgrades, pooling, or failover.
- RLS gives defense-in-depth authorization enforced at the database layer.
- Realtime and auth are available without building them ourselves.
- Faster onboarding: a managed project is ready in minutes.

### Negative / Risks

- Vendor coupling to Supabase-specific features (RLS helpers, realtime, auth).
- Less low-level control over Postgres configuration and extensions.
- Cost scales with usage; pricing and limits are set by the vendor.
- Migrating away later requires re-implementing auth/realtime and auditing RLS.

### Mitigations

- Keep schema and migrations in the repo so the data model is portable.
- Isolate Supabase-specific code behind clear modules.
- Document Supabase assumptions (this ADR and 0003).

## Alternatives considered

1. **Self-hosted Postgres (VM/container).** Maximum control and no vendor lock-in,
   but we would own backups, upgrades, pooling, monitoring, and on-call. Rejected
   as disproportionate operational cost for the team size.
2. **Managed Postgres without Supabase (e.g. a cloud provider's managed Postgres).**
   Removes operational burden but lacks integrated RLS-friendly auth and realtime;
   we would build those ourselves. Rejected for now.
3. **A non-relational managed database.** Rejected: the data model is relational
   and the application already depends on Postgres semantics.

## References

- [0003 — Supabase as system of record](./0003-supabase-as-system-of-record.md)
- [ADR template](./TEMPLATE.md)
