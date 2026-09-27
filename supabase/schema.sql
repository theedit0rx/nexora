-- ============================================================================
-- NEXORA — Autonomous Digital Agency OS
-- Supabase / Postgres schema
-- ----------------------------------------------------------------------------
-- The application runs on a JSON-file store by default (Demo Mode and local
-- development). Point it at Supabase by setting:
--
--   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
--
-- `lib/db/index.ts` picks the Supabase adapter automatically when both are
-- present. Run this file in the Supabase SQL editor (or `supabase db push`)
-- before starting the app. Row-level security is enabled on every table and
-- keyed off `auth.uid()` -> `organization_members`.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- helpers ---

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- Core: organisations, users, membership
-- ============================================================================

create table if not exists public.organizations (
  id             text primary key,
  name           text        not null,
  slug           text        not null unique,
  owner_name     text        not null default 'Sajid Raza',
  owner_email    text        not null default '',
  logo_url       text,
  brand_color    text        not null default '#6366f1',
  accent_color   text        not null default '#22d3ee',
  tagline        text        not null default 'Find. Build. Sell. Deliver. Automatically.',
  currency       text        not null default 'INR',
  timezone       text        not null default 'Asia/Kolkata',
  mode           text        not null default 'DEMO' check (mode in ('DEMO', 'LIVE')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.users (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  email           text        not null,
  full_name       text        not null,
  role            text        not null default 'OWNER' check (role in ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  avatar_url      text,
  password_hash   text,
  is_demo         boolean     not null default false,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, email)
);

create table if not exists public.organization_members (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  user_id         text        not null references public.users(id) on delete cascade,
  role            text        not null default 'OWNER',
  invited_email   text        not null default '',
  status          text        not null default 'ACTIVE',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.settings (
  id              text primary key,
  organization_id text        not null unique references public.organizations(id) on delete cascade,
  automation      jsonb       not null default '{}'::jsonb,
  permissions     jsonb       not null default '{}'::jsonb,
  outreach        jsonb       not null default '{}'::jsonb,
  lead_sources    jsonb       not null default '{}'::jsonb,
  ai              jsonb       not null default '{}'::jsonb,
  company         jsonb       not null default '{}'::jsonb,
  autonomy        jsonb       not null default '{}'::jsonb,
  notifications   jsonb       not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- Discovery & research
-- ============================================================================

create table if not exists public.businesses (
  id               text primary key,
  organization_id  text        not null references public.organizations(id) on delete cascade,
  lead_id          text,
  name             text        not null,
  category         text        not null,
  subcategory      text        not null default '',
  city             text        not null default '',
  region           text        not null default '',
  country          text        not null default 'India',
  address          text        not null default '',
  latitude         double precision,
  longitude        double precision,
  website          text,
  maps_url         text,
  phone            text,
  email            text,
  rating           double precision,
  review_count     integer,
  social_links     jsonb       not null default '{}'::jsonb,
  discovery_source text        not null default 'MANUAL',
  discovered_at     timestamptz not null default now(),
  raw              jsonb       not null default '{}'::jsonb
);
create index if not exists businesses_org_idx on public.businesses(organization_id);

create table if not exists public.leads (
  id                text primary key,
  organization_id   text        not null references public.organizations(id) on delete cascade,
  business_id       text        not null references public.businesses(id) on delete cascade,
  status            text        not null default 'DISCOVERED',
  pipeline_stage    text        not null default 'Discovered',
  priority          text check (priority in ('HOT', 'WARM', 'COLD', 'REJECTED')),
  score             integer     check (score between 0 and 100),
  website_status    text        not null default 'UNKNOWN',
  assigned_to       text,
  tags              text[]      not null default '{}',
  opt_out           boolean     not null default false,
  suppressed        boolean     not null default false,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  lost_reason       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists leads_org_idx on public.leads(organization_id);
create index if not exists leads_status_idx on public.leads(organization_id, status);

create table if not exists public.business_contacts (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  business_id     text        not null references public.businesses(id) on delete cascade,
  name            text        not null default '',
  role            text        not null default '',
  email           text,
  phone           text,
  is_primary      boolean     not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.research_reports (
  id                 text primary key,
  organization_id    text        not null references public.organizations(id) on delete cascade,
  lead_id            text        not null references public.leads(id) on delete cascade,
  business_id        text        not null references public.businesses(id) on delete cascade,
  summary            text        not null,
  services           text[]      not null default '{}',
  target_customer    text        not null default '',
  online_presence    text[]      not null default '{}',
  contact_channels   text[]      not null default '{}',
  social_activity    text        not null default '',
  existing_website   text        not null default '',
  business_maturity  text        not null default 'UNKNOWN',
  digital_opportunities text[]   not null default '{}',
  differentiators    text[]      not null default '{}',
  risks              text[]      not null default '{}',
  confidence         double precision not null default 0.5,
  provider           text        not null default 'local',
  model              text        not null default '',
  created_at         timestamptz not null default now()
);
create index if not exists research_lead_idx on public.research_reports(lead_id);

create table if not exists public.website_audits (
  id                       text primary key,
  organization_id          text        not null references public.organizations(id) on delete cascade,
  lead_id                  text        not null references public.leads(id) on delete cascade,
  url                      text,
  audited_at               timestamptz not null default now(),
  has_website              boolean     not null default false,
  reachable                boolean     not null default false,
  https                    boolean     not null default false,
  status_code              integer,
  load_time_ms             integer,
  mobile_responsive        text        not null default 'UNKNOWN',
  navigation_score         integer     not null default 0,
  visual_hierarchy_score   integer     not null default 0,
  design_era               text        not null default 'UNKNOWN',
  broken_pages             text[]      not null default '{}',
  has_contact_cta          boolean     not null default false,
  has_whatsapp             boolean     not null default false,
  has_forms                boolean     not null default false,
  has_booking              boolean     not null default false,
  has_ecommerce            boolean     not null default false,
  performance_score        integer     not null default 0,
  seo_score                integer     not null default 0,
  accessibility_score      integer     not null default 0,
  has_metadata             boolean     not null default false,
  has_social_links         boolean     not null default false,
  trust_elements           text[]      not null default '{}',
  conversion_opportunities text[]      not null default '{}',
  findings                 jsonb       not null default '[]'::jsonb,
  overall_grade            text        not null default '',
  provider                 text        not null default 'local',
  created_at               timestamptz not null default now()
);
create index if not exists audits_lead_idx on public.website_audits(lead_id);

create table if not exists public.lead_scores (
  id               text primary key,
  organization_id  text        not null references public.organizations(id) on delete cascade,
  lead_id          text        not null references public.leads(id) on delete cascade,
  total            integer     not null check (total between 0 and 100),
  priority         text        not null,
  factors          jsonb       not null default '[]'::jsonb,
  reasoning        text        not null default '',
  evidence_strength double precision not null default 0.5,
  scored_by        text        not null default 'scorer',
  created_at       timestamptz not null default now()
);
create index if not exists scores_lead_idx on public.lead_scores(lead_id);

create table if not exists public.opportunities (
  id                    text primary key,
  organization_id       text        not null references public.organizations(id) on delete cascade,
  lead_id               text        not null references public.leads(id) on delete cascade,
  service_key           text        not null default 'business-website',
  headline              text        not null,
  problem               text        not null,
  proposed_solution     text        not null,
  estimated_value       integer     not null default 0,
  estimated_effort_hours integer    not null default 0,
  confidence            double precision not null default 0.5,
  created_at            timestamptz not null default now()
);

create table if not exists public.strategies (
  id               text primary key,
  organization_id  text        not null references public.organizations(id) on delete cascade,
  lead_id          text        not null references public.leads(id) on delete cascade,
  template_family  text        not null,
  service_key      text        not null,
  pages            text[]      not null default '{}',
  sections         jsonb       not null default '[]'::jsonb,
  theme            jsonb       not null default '{}'::jsonb,
  copy_direction   text        not null default '',
  conversion_goals text[]      not null default '{}',
  must_have_features text[]    not null default '{}',
  seo_keywords     text[]      not null default '{}',
  rationale        text        not null default '',
  provider         text        not null default 'local',
  created_at       timestamptz not null default now()
);
create index if not exists strategies_lead_idx on public.strategies(lead_id);

-- ============================================================================
-- Build, QA, deployment
-- ============================================================================

create table if not exists public.demo_sites (
  id               text primary key,
  organization_id  text        not null references public.organizations(id) on delete cascade,
  lead_id          text        not null references public.leads(id) on delete cascade,
  strategy_id      text,
  slug             text        not null,
  business_name    text        not null,
  template_family  text        not null,
  service_key      text        not null,
  status           text        not null,
  pages            text[]      not null default '{}',
  output_dir       text        not null,
  preview_url      text        not null,
  theme            jsonb       not null default '{}'::jsonb,
  file_count       integer     not null default 0,
  total_bytes      integer     not null default 0,
  generated_by     text        not null default 'builder',
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists demo_sites_org_idx on public.demo_sites(organization_id);
create unique index if not exists demo_sites_slug_uidx on public.demo_sites(organization_id, slug);

create table if not exists public.qa_runs (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  target_type     text        not null check (target_type in ('DEMO', 'BUILD')),
  target_id       text        not null,
  verdict         text        not null check (verdict in ('PASS', 'PASS_WITH_WARNINGS', 'FAIL')),
  score           integer     not null check (score between 0 and 100),
  checks          jsonb       not null default '[]'::jsonb,
  passed_count    integer     not null default 0,
  failed_count    integer     not null default 0,
  warning_count   integer     not null default 0,
  duration_ms     integer     not null default 0,
  issues          text[]      not null default '{}',
  run_by          text        not null default 'qa',
  created_at      timestamptz not null default now()
);
create index if not exists qa_runs_target_idx on public.qa_runs(target_type, target_id);

create table if not exists public.deployments (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  target_type     text        not null check (target_type in ('DEMO', 'BUILD')),
  target_id       text        not null,
  project_id      text,
  kind            text        not null,
  state           text        not null default 'QUEUED',
  url             text        not null,
  provider        text        not null default 'local',
  provider_ref    text        not null default '',
  branch          text        not null default 'main',
  commit_sha      text        not null default '',
  build_log       text        not null default '',
  health_check    text        not null default 'UNKNOWN',
  custom_domain   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists deployments_target_idx on public.deployments(target_type, target_id);
create index if not exists deployments_org_idx on public.deployments(organization_id);

-- ============================================================================
-- Outreach & conversations
-- ============================================================================

create table if not exists public.campaigns (
  id               text primary key,
  organization_id  text        not null references public.organizations(id) on delete cascade,
  name             text        not null,
  goal             text        not null default '',
  status           text        not null default 'DRAFT',
  channel          text        not null default 'EMAIL',
  audience_filter  jsonb       not null default '{}'::jsonb,
  daily_limit      integer     not null default 20,
  sent_count       integer     not null default 0,
  reply_count      integer     not null default 0,
  created_by       text        not null default 'outreach',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.outreach_messages (
  id                 text primary key,
  organization_id    text        not null references public.organizations(id) on delete cascade,
  lead_id            text,
  campaign_id        text,
  channel            text        not null default 'EMAIL',
  status             text        not null default 'DRAFT',
  subject            text        not null default '',
  body               text        not null,
  personalization    text[]      not null default '{}',
  to_address         text        not null default '',
  provider_message_id text,
  thread_id          text,
  risk_level         text        not null default 'MEDIUM',
  approval_required  boolean     not null default true,
  approved_by        text,
  sent_at            timestamptz,
  opened_at          timestamptz,
  replied_at         timestamptz,
  error              text,
  created_by         text        not null default 'outreach',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists outreach_org_idx on public.outreach_messages(organization_id);
create index if not exists outreach_lead_idx on public.outreach_messages(lead_id);

create table if not exists public.conversations (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  lead_id         text,
  client_id       text,
  subject         text        not null,
  channel         text        not null default 'EMAIL',
  state           text        not null default 'OPEN',
  last_intent     text,
  unread_count    integer     not null default 0,
  assigned_to     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists conversations_org_idx on public.conversations(organization_id);

create table if not exists public.messages (
  id                 text primary key,
  organization_id    text        not null references public.organizations(id) on delete cascade,
  conversation_id    text        not null references public.conversations(id) on delete cascade,
  direction          text        not null check (direction in ('INBOUND', 'OUTBOUND')),
  channel            text        not null default 'EMAIL',
  from_address       text        not null default '',
  to_address         text        not null default '',
  subject            text        not null default '',
  body               text        not null,
  intent             text,
  intent_confidence  double precision,
  suggested_reply    text,
  is_from_agent      boolean     not null default false,
  agent_key          text,
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id);

-- ============================================================================
-- Sales & clients
-- ============================================================================

create table if not exists public.proposals (
  id                 text primary key,
  organization_id    text        not null references public.organizations(id) on delete cascade,
  lead_id            text,
  client_id          text,
  number             text        not null,
  status             text        not null default 'DRAFT',
  title              text        not null,
  project_summary    text        not null default '',
  problem            text        not null default '',
  proposed_solution  text        not null default '',
  pages              text[]      not null default '{}',
  functionality      text[]      not null default '{}',
  deliverables       text[]      not null default '{}',
  milestones         jsonb       not null default '[]'::jsonb,
  subtotal           integer     not null default 0,
  discount           integer     not null default 0,
  total              integer     not null default 0,
  currency           text        not null default 'INR',
  valid_until        timestamptz,
  revision_policy    text        not null default '',
  maintenance_terms  text        not null default '',
  hosting_terms      text        not null default '',
  terms_placeholder  text        not null default '',
  upgrade_options    jsonb       not null default '[]'::jsonb,
  created_by         text        not null default 'proposal',
  sent_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists proposals_org_idx on public.proposals(organization_id);
create unique index if not exists proposals_number_uidx on public.proposals(organization_id, number);

create table if not exists public.proposal_items (
  id           text primary key,
  proposal_id  text        not null references public.proposals(id) on delete cascade,
  label        text        not null,
  description  text        not null default '',
  quantity     integer     not null default 1,
  unit_price   integer     not null default 0,
  amount       integer     not null default 0,
  kind         text        not null default 'BASE'
);
create index if not exists proposal_items_proposal_idx on public.proposal_items(proposal_id);

create table if not exists public.clients (
  id                  text primary key,
  organization_id     text        not null references public.organizations(id) on delete cascade,
  lead_id             text,
  business_id         text,
  name                text        not null,
  slug                text        not null,
  status              text        not null default 'ONBOARDING',
  lifetime_value      integer     not null default 0,
  monthly_recurring   integer     not null default 0,
  contract_value      integer     not null default 0,
  onboarding_progress integer     not null default 0,
  primary_email       text        not null default '',
  primary_phone       text        not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists clients_org_idx on public.clients(organization_id);
create unique index if not exists clients_slug_uidx on public.clients(organization_id, slug);

create table if not exists public.client_contacts (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  client_id       text        not null references public.clients(id) on delete cascade,
  name            text        not null default '',
  role            text        not null default '',
  email           text,
  phone           text,
  is_primary      boolean     not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.onboarding_submissions (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  client_id       text        not null references public.clients(id) on delete cascade,
  status          text        not null default 'PENDING',
  completion      integer     not null default 0,
  data            jsonb       not null default '{}'::jsonb,
  missing         text[]      not null default '{}',
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.projects (
  id               text primary key,
  organization_id  text        not null references public.organizations(id) on delete cascade,
  client_id        text        not null references public.clients(id) on delete cascade,
  proposal_id      text,
  strategy_id      text,
  name             text        not null,
  slug             text        not null,
  service_key      text        not null,
  stage            text        not null default 'Planning',
  progress         integer     not null default 0,
  repository_url   text,
  preview_url      text,
  production_url   text,
  due_date         timestamptz,
  value            integer     not null default 0,
  repo_provider    text        not null default 'github',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists projects_org_idx on public.projects(organization_id);
create index if not exists projects_client_idx on public.projects(client_id);

create table if not exists public.project_requirements (
  id              text primary key,
  project_id      text        not null references public.projects(id) on delete cascade,
  title           text        not null,
  detail          text        not null default '',
  status          text        not null default 'OPEN',
  source          text        not null default 'PROPOSAL',
  created_at      timestamptz not null default now()
);

create table if not exists public.website_builds (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  project_id      text        not null references public.projects(id) on delete cascade,
  strategy_id     text,
  version         integer     not null default 1,
  status          text        not null,
  output_dir      text        not null,
  pages           text[]      not null default '{}',
  components_used text[]      not null default '{}',
  file_count      integer     not null default 0,
  total_bytes     integer     not null default 0,
  built_by        text        not null default 'production_builder',
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- Support & upsell
-- ============================================================================

create table if not exists public.support_tickets (
  id                   text primary key,
  organization_id      text        not null references public.organizations(id) on delete cascade,
  client_id            text,
  project_id           text,
  subject              text        not null,
  category             text        not null default 'unknown',
  status               text        not null default 'OPEN',
  priority             text        not null default 'NORMAL',
  description          text        not null default '',
  resolution           text        not null default '',
  is_upsell            boolean     not null default false,
  upsell_opportunity_id text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists tickets_org_idx on public.support_tickets(organization_id);

create table if not exists public.upsell_opportunities (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  client_id       text,
  project_id      text,
  title           text        not null,
  rationale       text        not null default '',
  estimated_value integer     not null default 0,
  status          text        not null default 'NEW',
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- Agent runtime
-- ============================================================================

create table if not exists public.agent_definitions (
  id                   text primary key,
  organization_id      text        not null references public.organizations(id) on delete cascade,
  key                  text        not null,
  name                 text        not null,
  purpose              text        not null default '',
  description          text        not null default '',
  icon                 text        not null default 'bot',
  state                text        not null default 'IDLE',
  permission_level     text        not null default 'GREEN',
  model                text        not null default 'local-deterministic',
  provider             text        not null default 'local',
  tools                text[]      not null default '{}',
  config               jsonb       not null default '{}'::jsonb,
  runs_today           integer     not null default 0,
  success_rate         double precision not null default 1,
  avg_execution_ms     integer     not null default 0,
  last_run_at          timestamptz,
  current_task_id      text,
  current_task_label   text,
  consecutive_failures integer     not null default 0,
  paused               boolean     not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (organization_id, key)
);
create index if not exists agents_org_idx on public.agent_definitions(organization_id);

create table if not exists public.agent_runs (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  agent_key       text        not null,
  task_id         text,
  trigger         text        not null default 'MANUAL',
  status          text        not null default 'QUEUED',
  input           jsonb       not null default '{}'::jsonb,
  output          jsonb       not null default '{}'::jsonb,
  error           text,
  duration_ms     integer     not null default 0,
  tokens_in       integer     not null default 0,
  tokens_out      integer     not null default 0,
  cost_usd        double precision not null default 0,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index if not exists agent_runs_org_idx on public.agent_runs(organization_id, agent_key);

create table if not exists public.agent_tasks (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  agent_key       text        not null,
  type            text        not null,
  entity_type     text        not null default '',
  entity_id       text        not null default '',
  priority        text        not null default 'NORMAL',
  input           jsonb       not null default '{}'::jsonb,
  status          text        not null default 'QUEUED',
  progress        integer     not null default 0,
  output          jsonb       not null default '{}'::jsonb,
  error           text,
  retry_count     integer     not null default 0,
  max_retries     integer     not null default 2,
  risk_level      text        not null default 'LOW',
  approval_id     text,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);
create index if not exists agent_tasks_org_idx on public.agent_tasks(organization_id, agent_key);

create table if not exists public.agent_logs (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  agent_key       text,
  run_id          text,
  task_id         text,
  level           text        not null default 'INFO',
  message         text        not null,
  meta            jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists agent_logs_org_idx on public.agent_logs(organization_id, created_at desc);

-- ============================================================================
-- Governance & audit
-- ============================================================================

create table if not exists public.approval_requests (
  id                text primary key,
  organization_id   text        not null references public.organizations(id) on delete cascade,
  action            text        not null,
  title             text        not null,
  reason            text        not null default '',
  requesting_agent  text        not null,
  entity_type       text        not null default '',
  entity_id         text        not null default '',
  risk_level        text        not null default 'MEDIUM',
  permission_level  text        not null default 'YELLOW',
  status            text        not null default 'PENDING',
  payload           jsonb       not null default '{}'::jsonb,
  diff              jsonb       not null default '{}'::jsonb,
  decision_note     text,
  decided_by        text,
  decided_at        timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists approvals_org_idx on public.approval_requests(organization_id, status);

create table if not exists public.activity_events (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  actor_type      text        not null,
  actor_id        text,
  actor_label     text        not null default '',
  agent_key       text,
  action_type     text        not null,
  title           text        not null,
  detail          text        not null default '',
  entity_type     text        not null default '',
  entity_id       text        not null default '',
  lead_id         text,
  client_id       text,
  project_id      text,
  risk_level      text        not null default 'LOW',
  status          text        not null default 'OK',
  created_at      timestamptz not null default now()
);
create index if not exists activity_org_idx on public.activity_events(organization_id, created_at desc);

create table if not exists public.notifications (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  type            text        not null,
  title           text        not null,
  body            text        not null default '',
  severity        text        not null default 'INFO',
  href            text,
  read            boolean     not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists notifications_org_idx on public.notifications(organization_id, created_at desc);

create table if not exists public.audit_logs (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  actor_type      text        not null,
  actor_id        text,
  actor_label     text        not null default '',
  action          text        not null,
  entity_type     text        not null default '',
  entity_id       text        not null default '',
  before          jsonb       not null default '{}'::jsonb,
  after           jsonb       not null default '{}'::jsonb,
  ip              text        not null default '',
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- Commerce
-- ============================================================================

create table if not exists public.revenue_events (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  client_id       text,
  project_id      text,
  proposal_id     text,
  kind            text        not null,
  amount          integer     not null default 0,
  currency        text        not null default 'INR',
  status          text        not null default 'PENDING',
  description     text        not null default '',
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists revenue_org_idx on public.revenue_events(organization_id);

create table if not exists public.services (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  key             text        not null,
  name            text        not null,
  description     text        not null default '',
  base_price      integer     not null default 0,
  currency        text        not null default 'INR',
  delivery_days   integer     not null default 14,
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.pricing_rules (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  service_key     text        not null,
  label           text        not null,
  kind            text        not null default 'ADDON',
  price           integer     not null default 0,
  description     text        not null default '',
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- Integrations
-- ============================================================================

create table if not exists public.integrations (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  key             text        not null,
  name            text        not null,
  category        text        not null,
  status          text        not null default 'NOT_CONNECTED',
  config          jsonb       not null default '{}'::jsonb,
  last_sync_at    timestamptz,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, key)
);

-- Only non-secret metadata is stored here. Secrets live in Supabase Vault.
create table if not exists public.integration_credentials_metadata (
  id              text primary key,
  organization_id text        not null references public.organizations(id) on delete cascade,
  integration_key text        not null,
  key_name        text        not null,
  fingerprint     text        not null default '',
  created_at      timestamptz not null default now(),
  unique (organization_id, integration_key, key_name)
);

-- ============================================================================
-- updated_at triggers
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','settings','leads','demo_sites','deployments','campaigns',
    'outreach_messages','conversations','proposals','clients','onboarding_submissions',
    'projects','website_builds','support_tickets','agent_definitions','integrations'
  ]
  loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$s', t);
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$s
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Every table is scoped to the caller's organisation. The service-role key
-- bypasses RLS (used by server-side route handlers); browser access always
-- goes through the user's JWT.
-- ============================================================================

create or replace function public.current_organization_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()::text
  limit 1;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','users','organization_members','settings','businesses','business_contacts',
    'leads','research_reports','website_audits','lead_scores','opportunities','strategies',
    'demo_sites','qa_runs','deployments','campaigns','outreach_messages','conversations','messages',
    'proposals','proposal_items','clients','client_contacts','onboarding_submissions',
    'projects','project_requirements','website_builds','support_tickets','upsell_opportunities',
    'agent_definitions','agent_runs','agent_tasks','agent_logs','approval_requests',
    'activity_events','notifications','audit_logs','revenue_events','services','pricing_rules',
    'integrations','integration_credentials_metadata'
  ]
  loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists %1$s_org_isolation on public.%1$s', t);
    execute format(
      'create policy %1$s_org_isolation on public.%1$s
       for all using (organization_id = public.current_organization_id())
       with check (organization_id = public.current_organization_id())', t);
  end loop;
end $$;

-- The organizations table is keyed off its own primary key.
drop policy if exists organizations_org_isolation on public.organizations;
create policy organizations_org_isolation on public.organizations
  for all using (id = public.current_organization_id())
  with check (id = public.current_organization_id());

-- Child tables without an organization_id inherit it through their parent.
drop policy if exists proposal_items_org_isolation on public.proposal_items;
create policy proposal_items_org_isolation on public.proposal_items
  for all using (
    exists (select 1 from public.proposals p
            where p.id = proposal_items.proposal_id
              and p.organization_id = public.current_organization_id())
  ) with check (
    exists (select 1 from public.proposals p
            where p.id = proposal_items.proposal_id
              and p.organization_id = public.current_organization_id())
  );

drop policy if exists project_requirements_org_isolation on public.project_requirements;
create policy project_requirements_org_isolation on public.project_requirements
  for all using (
    exists (select 1 from public.projects p
            where p.id = project_requirements.project_id
              and p.organization_id = public.current_organization_id())
  ) with check (
    exists (select 1 from public.projects p
            where p.id = project_requirements.project_id
              and p.organization_id = public.current_organization_id())
  );

drop policy if exists messages_org_isolation on public.messages;
create policy messages_org_isolation on public.messages
  for all using (
    exists (select 1 from public.conversations c
            where c.id = messages.conversation_id
              and c.organization_id = public.current_organization_id())
  ) with check (
    exists (select 1 from public.conversations c
            where c.id = messages.conversation_id
              and c.organization_id = public.current_organization_id())
  );

-- ============================================================================
-- Realtime
-- ============================================================================

alter publication supabase_realtime add table public.activity_events;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.approval_requests;
