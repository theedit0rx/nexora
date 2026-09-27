# NEXORA — Autonomous Digital Agency OS

**Find. Build. Sell. Deliver. Automatically.**

NEXORA is an autonomous digital agency that runs itself. It discovers local
businesses with weak or missing websites, researches them, audits their online
presence, scores the opportunity, designs and builds a tailored demo website,
runs QA, deploys a preview, writes personalised outreach, classifies replies,
drafts proposals, and — once a deal is signed — onboards the client, builds the
production site and handles support.

Every autonomous step is visible, auditable and reversible. Anything external or
irreversible stops for your approval.

```
Discover → Research → Audit → Score → Strategise → Build → QA → Deploy
   → Outreach → Reply → Proposal → Won → Onboard → Build → Deliver → Support
```

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The app runs with **zero configuration** on a local JSON store. Click
**Explore Demo Mode** on the login screen to get a fully populated workspace
with 8 prospects at every pipeline stage, live demo sites, proposals, a signed
client, tickets and approvals.

### Credentials

| Workspace | Email | Password |
| --- | --- | --- |
| Primary (empty) | `owner@nexora.app` | set on first sign-up |
| Demo (seeded) | `owner@nexora.demo` | `nexora-demo` |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite |
| `npm run lint` | Next lint |

---

## The agent fleet

Fourteen specialists, each with an explicit permission level, a daily budget and
a live state you can override from the Agents page or the kill switch.

| Agent | Key | Does | Level |
| --- | --- | --- | --- |
| Scout | `scout` | Discovers prospects from lead sources | 🟢 |
| Researcher | `researcher` | Builds a business intelligence dossier | 🟢 |
| Auditor | `auditor` | Scores SEO, performance, mobile, trust, conversion | 🟢 |
| Scorer | `scorer` | Weighted 0–100 opportunity score + HOT/WARM/COLD | 🟢 |
| Strategist | `strategist` | Chooses the template family, pages, sections, theme, copy direction | 🟢 |
| Builder | `builder` | Generates the demo website on disk | 🟡 |
| QA | `qa` | 15-check suite; blocks a failing build from deploying | 🟡 |
| Deployer | `deployer` | Deploys previews; production is always gated | 🔴 |
| Outreach | `outreach` | Writes and queues personalised messages | 🟡 |
| Sales | `sales` | Classifies inbound intent, drafts proposals | 🟡 |
| Proposal | `proposal` | Builds proposals from the pricing engine | 🔴 |
| Onboarding | `onboarding` | Collects client assets, tracks completion | 🟡 |
| Production Builder | `production_builder` | Builds the live client site | 🟡 |
| Support | `support` | Triages tickets, spots upsells | 🟡 |

**Permission levels**

- 🟢 **GREEN** — runs autonomously, logs the outcome.
- 🟡 **YELLOW** — acts autonomously, but asks before anything irreversible or external.
- 🔴 **RED** — never acts. Produces a proposal the owner must approve.

### The kill switch

The top bar carries **PAUSE AUTONOMY**. Engaging it parks every agent that could
act externally, preserves all data, and makes the state obvious on every page.
Manual moves, notes and replies still work while it is engaged.

---

## Pages

| Route | What's there |
| --- | --- |
| `/dashboard` | Revenue, pipeline value, funnel, agent activity, hottest opportunities, approval queue |
| `/pipeline` | 13-column drag-and-drop board from Discovered to Lost |
| `/leads` | Filterable CRM table; open a lead for research, audit, strategy, demo, outreach and timeline tabs |
| `/agents` | Fleet cards with permission levels, budgets and pause controls |
| `/agents/[key]` | Runs, task queue and structured agent log |
| `/activity` | Append-only feed of every agent and owner action, filterable by actor/status/risk |
| `/clients` | Signed clients, onboarding progress, LTV, support load |
| `/clients/[id]` | Onboarding checklist, projects, proposals, revenue events |
| `/projects` | Delivery board across Planning → Maintenance |
| `/projects/[id]` | Requirements, commercials, agent tasks, delivery history |
| `/websites` | Every demo and production build, its QA verdict and deployment state |
| `/conversations` | Inbox with classified intent and suggested replies |
| `/proposals` | Proposal table with full line items, milestones and decision states |
| `/support` | Triaged tickets with priority, sentiment and resolutions |
| `/approvals` | Gated actions — approve or reject with a note |
| `/analytics` | Conversion funnel, outreach results, revenue, sources, industries, agent performance, LTV |
| `/settings` | Automation toggles, permission boundaries, lead sources, AI provider, notifications, integrations |
| `/portal` | The client-facing view: onboarding, live sites, delivery, support |

---

## API

All routes live under `app/api` and are wrapped by `lib/api.ts` — they
authenticate the session, enforce the owner-only gate where needed, and return
`{ ok: false, error }` on failure.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/login` | POST | `{ email, password, next? }` |
| `/api/auth/signup` | POST | `{ email, password, fullName, organizationName }` |
| `/api/auth/demo` | POST | Seeds and signs into the demo workspace |
| `/api/auth/logout` | POST | Clears the session cookie |
| `/api/live` | GET | `{ notifications, unread, autonomyPaused, pendingApprovals }` |
| `/api/search?q=` | GET | Global search grouped by entity kind |
| `/api/copilot` | POST | `{ query }` → `{ reply, actions }` |
| `/api/copilot/action` | POST | Executes a confirmed copilot action |
| `/api/autonomy` | POST | Kill switch + granular pause flags |
| `/api/notifications/read` | POST | Marks every notification read |
| `/api/agents/run` | POST | `{ action, leadId? }` — currently `research_latest` |
| `/api/agents/[key]/pause` | POST | `{ paused }` |
| `/api/leads` | POST | Manually add a lead |
| `/api/leads/[id]/run` | POST | Run the pipeline (optionally for specific stages) |
| `/api/leads/[id]/pipeline` | POST | Move a lead between pipeline stages |
| `/api/approvals/[id]` | POST | `{ decision, note?, modifiedPayload? }` |
| `/api/proposals/[id]/status` | POST | Change status; accepting creates client + project + revenue |
| `/api/projects/[id]/stage` | POST | Move a project between delivery stages |
| `/api/settings` | GET / POST | Read or patch settings |
| `/api/outreach/[id]/send` | POST | Send a queued message |
| `/api/conversations/[id]/reply` | POST | Owner reply + simulated inbound classification |
| `/api/support/[id]` | POST | Update ticket status and resolution |
| `/api/scout` | POST | Run discovery `{ city, category, limit, source?, csvText? }` |
| `/api/websites/[id]/deploy` | POST | Deploy preview, or queue production for approval |
| `/api/tasks/[id]/retry` | POST | Requeue a failed task |
| `/api/onboarding` | POST | Save onboarding data and recompute completion |
| `/api/demo/reset` | POST | Wipe and reseed the demo workspace |

---

## Architecture

```
app/
  (auth)/login/            Sign in, sign up, demo
  (app)/layout.tsx         Server shell: auth, bootstrap, counts, health
  (app)/**                 19 pages
  api/**                   24 route groups
components/
  shell/                   Sidebar, topbar, command palette, copilot, app shell
  ui/                      Design-system barrel + data table
  charts/                  Recharts wrappers (funnel, area, bars, lines, donut)
  leads|pipeline|projects|clients|proposals|conversations|support|
  approvals|websites|portal|agents|activity|settings/   Feature components
lib/
  auth/session.ts          JWT sessions, login, requireAuth
  api.ts                   json / fail / handler / readBody
  db/schema.ts             42 Zod table schemas + Database type
  db/local-store.ts        File-backed relational store (FK, unique, cascade, indexes)
  db/supabase-adapter.ts   Postgres adapter
  agents/                  registry, discovery, analysis, build, sales
  workflows/pipeline.ts    8-stage autonomous pipeline + supervisor
  events/bus.ts            Typed event bus, activity log, notifications
  metrics.ts               Every dashboard/analytics figure
  search.ts                Global search
  copilot.ts               Intent-routed command interface
  permissions.ts           Permission evaluation
  pricing/engine.ts        Services and pricing rules
  qa/engine.ts             15-check QA suite
  sites/generator.ts       Static site generator
  tasks/engine.ts          Task queue with retries
  providers/               Lead sources + messaging providers
data/demo-fixtures.ts      8 realistic prospects at every stage
supabase/schema.sql        42 tables, RLS, triggers, realtime
tests/                     Vitest suite
```

### Data layer

`lib/db` picks its adapter automatically:

- **Local store** (default) — a JSON file with Zod validation, foreign keys,
  unique constraints, cascade deletes and in-memory indexes. Atomic writes via
  temp file + rename. This is what Demo Mode and local development use.
- **Supabase** — selected when `NEXT_PUBLIC_SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are set. Run `supabase/schema.sql` first.

### Metrics are never faked

`replyRate` and `acceptanceRate` are `null` — not `0` — when the denominator is
zero. `analytics.hasData` gates the "no data yet" empty states. Every number on
the dashboard, pipeline and analytics pages is computed from stored rows.

### The copilot never lies

`lib/copilot.ts` routes 15 intents over real data. Destructive actions
(`pause autonomy`, `pause outreach`, `reset demo`) return a `confirm_action`
that the UI resolves through the API — the reply never claims the action
already happened.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXORA_SESSION_SECRET` | dev fallback | JWT signing secret — **set in production** |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Enables the Supabase adapter |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Server-side Supabase access |
| `NEXORA_DB_FILE` | `.data/nexora.json` | Local store location |
| `NEXORA_SITE_ROOT` | `public/generated` | Where generated sites are written |
| `NEXORA_MODE` | auto | Force `demo` or `live` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | — | Optional LLM providers; falls back to the deterministic local engine |

### Messaging providers

Outbound email and WhatsApp sit behind small provider adapters
(`lib/providers/messaging.ts`). Resolution order is the provider named by
`EMAIL_PROVIDER`, then any provider with credentials present, then:

- **Demo Mode** — a `simulated` adapter that records the send locally and stamps
  the result `simulated: true`. The activity feed and the message row both say
  so, so nothing implies real mail left the building.
- **Live Mode** — stays unavailable and the caller surfaces the honest error.

Set `RESEND_API_KEY`, or `GMAIL_*` / `SMTP_*`, to send for real.

### AI providers

The agents run on a deterministic local engine by default — no API keys, no
network calls, fully reproducible. Point Settings → AI provider at
`openai`, `anthropic`, `groq` or `gemini` and the agents use that model, with
`fallbackToLocal` keeping the pipeline running when the provider errors.

---

## Testing

```bash
npm test
```

15 tests across three suites:

- `tests/store.test.ts` — table completeness, CRUD round-trips, foreign keys,
  unique constraints, disk persistence, bulk inserts.
- `tests/copilot.test.ts` — intent routing, and the guarantee that destructive
  intents return a confirmation instead of claiming success.
- `tests/metrics.test.ts` — null rates on an empty workspace.

Each run gets an isolated store file under the OS temp directory.

---

## Design system

Dark-first, premium, technical. `app/globals.css` defines the token set:

- Surfaces `base` → `surface` → `surface-2` → `surface-3`, `line`, `line-strong`
- Brand `brand-50…900`, accent `accent-200…600`
- Semantic `success`, `warning`, `danger`, `info`
- Ink `ink-strong`, `ink`, `ink-muted`, `ink-faint`
- Utilities `panel`, `panel-flat`, `hairline`, `grid-lines`, `skeleton`,
  `tnum`, `scrollbar-none`, `text-gradient`
- Animations `rise`, `fade`, `slide-left`, `pulse-soft`, `shimmer`

---

## Notes

- `middleware.ts` only checks that a session cookie is present. Authorisation is
  enforced server-side in every route handler and server component — the browser
  is never trusted for permissions.
- Production deployments always raise an approval request; the Deployer never
  ships to production on its own.
- Generated demo sites are written to `public/generated` and served at
  `/generated/<slug>/index.html`.
