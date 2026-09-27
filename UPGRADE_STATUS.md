# NEXORA upgrade status

## Verified in this checkpoint

- Local lead workflow: research, audit, scoring, strategy, HTML generation, QA, local preview and an unsent outreach draft.
- Signup validates input, creates a separate organization, hashes passwords with scrypt and issues a session. Login checks credentials and safe redirect destinations. Logout clears the cookie and redirects to a relative login URL.
- Mutation endpoints reject cross-site browser requests; request JSON is capped at 256 KB. Auth attempts have a process-local limiter. Unauthenticated APIs return 401 JSON.
- Agent metrics, state and resource access are organization-scoped. Pipeline requests reject foreign leads, stop at paused/disabled/failed stages and report completion accurately.
- Deployment requires a passing QA result. Remote queued deployments remain queued, and local adapters cannot deploy production sites.
- Generated pages have visible main landmarks. Unpublished previews use noindex instead of malformed canonical URLs. Synthetic testimonials and invented statistics were removed; remaining suggested copy requires business approval.
- Proposal conversion checks tenant ownership and creates pending revenue, not invoiced or paid revenue. Client/project slugs include the organization ID.
- Audits and link checks validate public destinations, pin DNS, validate redirects, limit response size and enforce deadlines.
- AI gateway supports validated sales-intent classification with explicit opt-out handling and configured fallbacks. Other agents are not fully integrated with the gateway.
- ESLint is configured and runnable.

## Reproducible validation

Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, then `node scripts/smoke-http.mjs`.

The automated suite has 48 passing tests, including a complete local lead workflow. The HTTP smoke script uses an isolated temporary database and disposable session secret, and checks authentication, dashboard rendering, invalid inputs, cross-site rejection, safe redirects, demo restrictions and logout. It sends no outreach messages. This does not replace interactive browser QA or live provider verification.

## Configuration

Set a random `NEXORA_SESSION_SECRET` of at least 32 characters. Set `NEXORA_ENABLE_DEMO=false` to disable public demo login. Default authentication uses local password records even when Supabase stores data. `NEXORA_AUTH_PROVIDER=supabase` selects Supabase login; account provisioning/verification must be completed separately. Read AI_GATEWAY_SETUP.md for gateway configuration.

## Outstanding production work

The application is not yet a fully autonomous production service. Remaining engineering includes durable worker execution/recovery, deployment status polling, persistent cloud artifact storage/rollback, account recovery/session revocation, comprehensive validation and permissions across remaining endpoints, generated form delivery, verified business content, and interactive browser QA. Local filesystem data/artifacts are not persistent on Vercel. Pause checks do not cancel in-flight tasks. The process-local auth limiter needs centralized enforcement in multi-instance deployments. Legacy SHA-256 password records require a secure recovery/migration flow.

Real AI, discovery, email, payments and hosting integrations require configured accounts/credentials and live end-to-end verification. No real email or payment was triggered by these tests. Vercel publishing remains deferred while account verification is unresolved; no live preview URL is claimed.
