# NEXORA upgrade status

## Implemented in this checkpoint

- Agent state and metrics scoped by organization; agent resource lookups reject foreign tenant IDs.
- Shared task runner checks workspace and agent pauses before execution.
- Website audits and internal link checks use validated public destinations, pinned DNS addresses, redirect validation, response limits and request deadlines.
- Production deployments require Vercel; local preview adapters reject production requests.
- Queued remote deployments remain queued; completion events and production URLs are written only when the provider reports READY. Health remains UNKNOWN until measured.
- Analytics includes stored audits.
- Demo output paths contain organization and lead IDs; production builds use unique artifact paths instead of overwriting previous versions.
- Live workspace initialization uses the authenticated organization. Supabase authentication failures do not fall back to local authentication.
- Regression coverage for tenant resource boundaries, agent state/metrics, pause enforcement, password hashing, deployment restrictions and unsafe URLs.

## Operational requirements and remaining work

This is a hardening checkpoint, not a completed autonomous production service.
Set a random NEXORA_SESSION_SECRET of at least 32 characters. Legacy SHA-256
password hashes are rejected; a secure account recovery/migration flow is still
needed for old users. Public demo access remains enabled.

Before production use, complete durable worker execution and recovery, centralized
permissions for all resources and external actions, session revocation and account
recovery, provider integration with the agents, browser QA, deployment status polling,
durable artifact storage, artifact rollback and full workflow tests. Local filesystem
storage is not persistent on Vercel. Agent permission and pause checks do not cancel
already running operations. New artifact paths preserve files locally but do not
implement cloud rollback. Website content provenance still needs work.

Use `npm run typecheck`, `npm test`, and `npm run build` to verify this checkpoint.
Network integration and browser behavior are not covered by the current regression suite.
