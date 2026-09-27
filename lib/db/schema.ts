import { z } from "zod";

/* ==========================================================================
   NEXORA — Domain Schema (single source of truth)
   Every table is a Zod schema. Types are derived from it.
   The local store and the Supabase adapter both speak this contract.
   ========================================================================== */

export const id = z.string().min(1);
export type ID = z.infer<typeof id>;

export const iso = z.string();
export const nowIso = () => new Date().toISOString();

/* ---------------------------------------------------------------- enums --- */

export const LeadStatus = z.enum([
  "DISCOVERED",
  "RESEARCHING",
  "AUDITING",
  "AUDITED",
  "SCORED",
  "QUALIFIED",
  "REJECTED",
  "STRATEGY",
  "DEMO_BUILDING",
  "DEMO_READY",
  "OUTREACH",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const PipelineStage = z.enum([
  "Discovered",
  "Researching",
  "Audited",
  "Qualified",
  "Demo Building",
  "Demo Ready",
  "Outreach",
  "Replied",
  "Interested",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
]);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const Priority = z.enum(["HOT", "WARM", "COLD", "REJECTED"]);
export type Priority = z.infer<typeof Priority>;

export const WebsiteStatus = z.enum([
  "NONE",
  "BROKEN",
  "OUTDATED",
  "AVERAGE",
  "MODERN",
  "UNKNOWN",
]);
export type WebsiteStatus = z.infer<typeof WebsiteStatus>;

export const AgentState = z.enum([
  "IDLE",
  "WORKING",
  "WAITING",
  "FAILED",
  "PAUSED",
]);
export type AgentState = z.infer<typeof AgentState>;

export const AgentKey = z.enum([
  "supervisor",
  "scout",
  "researcher",
  "auditor",
  "scorer",
  "strategist",
  "builder",
  "qa",
  "deployer",
  "outreach",
  "sales",
  "proposal",
  "onboarding",
  "production_builder",
  "support",
]);
export type AgentKey = z.infer<typeof AgentKey>;

export const PermissionLevel = z.enum(["GREEN", "YELLOW", "RED"]);
export type PermissionLevel = z.infer<typeof PermissionLevel>;

export const TaskStatus = z.enum([
  "QUEUED",
  "RUNNING",
  "WAITING",
  "RETRYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "BLOCKED",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskPriority = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const ApprovalStatus = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "MODIFIED",
  "EXPIRED",
  "CANCELLED",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const OutreachChannel = z.enum(["EMAIL", "WHATSAPP", "MANUAL", "SMS"]);
export type OutreachChannel = z.infer<typeof OutreachChannel>;

export const OutreachStatus = z.enum([
  "DRAFT",
  "WAITING_APPROVAL",
  "APPROVED",
  "QUEUED",
  "SENT",
  "DELIVERED",
  "OPENED",
  "REPLIED",
  "BOUNCED",
  "FAILED",
  "CANCELLED",
]);
export type OutreachStatus = z.infer<typeof OutreachStatus>;

export const ConversationState = z.enum([
  "OPEN",
  "AGENTED",
  "WAITING_ON_PROSPECT",
  "WAITING_ON_OWNER",
  "CLOSED",
]);
export type ConversationState = z.infer<typeof ConversationState>;

export const MessageIntent = z.enum([
  "INTERESTED",
  "QUESTION",
  "PRICE_QUERY",
  "NOT_INTERESTED",
  "FOLLOW_UP",
  "NEEDS_HUMAN",
  "SPAM",
  "UNKNOWN",
]);
export type MessageIntent = z.infer<typeof MessageIntent>;

export const ProposalStatus = z.enum([
  "DRAFT",
  "WAITING_APPROVAL",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const ProjectStage = z.enum([
  "Planning",
  "Building",
  "QA",
  "Client Review",
  "Deployment",
  "Completed",
  "Maintenance",
]);
export type ProjectStage = z.infer<typeof ProjectStage>;

export const QaVerdict = z.enum(["PASS", "PASS_WITH_WARNINGS", "FAIL"]);
export type QaVerdict = z.infer<typeof QaVerdict>;

export const DeploymentKind = z.enum(["PREVIEW", "PRODUCTION"]);
export type DeploymentKind = z.infer<typeof DeploymentKind>;

export const DeploymentState = z.enum([
  "QUEUED",
  "BUILDING",
  "READY",
  "ERROR",
  "CANCELED",
]);
export type DeploymentState = z.infer<typeof DeploymentState>;

export const TicketStatus = z.enum(["OPEN", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const TicketCategory = z.enum([
  "content change",
  "image change",
  "broken link",
  "bug",
  "design request",
  "new feature",
  "billing question",
  "domain issue",
  "hosting issue",
  "unknown",
]);
export type TicketCategory = z.infer<typeof TicketCategory>;

export const IntegrationStatus = z.enum([
  "CONNECTED",
  "NOT_CONNECTED",
  "WARNING",
  "ERROR",
]);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const RiskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

/* --------------------------------------------------------------- tables --- */

export const OrganizationSchema = z.object({
  id: id,
  name: z.string(),
  slug: z.string(),
  ownerName: z.string().default("Sajid Raza"),
  ownerEmail: z.string().default(""),
  logoUrl: z.string().nullable().default(null),
  brandColor: z.string().default("#6366f1"),
  accentColor: z.string().default("#22d3ee"),
  tagline: z.string().default("Find. Build. Sell. Deliver. Automatically."),
  currency: z.string().default("INR"),
  timezone: z.string().default("Asia/Kolkata"),
  mode: z.enum(["DEMO", "LIVE"]).default("DEMO"),
  createdAt: iso,
  updatedAt: iso,
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const UserSchema = z.object({
  id: id,
  organizationId: id,
  email: z.string().email(),
  fullName: z.string(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("OWNER"),
  avatarUrl: z.string().nullable().default(null),
  passwordHash: z.string().nullable().default(null),
  isDemo: z.boolean().default(false),
  lastLoginAt: iso.nullable().default(null),
  createdAt: iso,
});
export type User = z.infer<typeof UserSchema>;

export const OrganizationMemberSchema = z.object({
  id: id,
  organizationId: id,
  userId: id,
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
  createdAt: iso,
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export const BusinessContactSchema = z.object({
  id: id,
  businessId: id,
  type: z.enum(["EMAIL", "PHONE", "WHATSAPP", "FORM", "ADDRESS", "SOCIAL", "MAPS"]),
  label: z.string().default(""),
  value: z.string(),
  isPrimary: z.boolean().default(false),
  source: z.string().default(""),
  createdAt: iso,
});
export type BusinessContact = z.infer<typeof BusinessContactSchema>;

export const BusinessSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id.nullable().default(null),
  name: z.string(),
  category: z.string(),
  subcategory: z.string().default(""),
  city: z.string().default(""),
  region: z.string().default(""),
  country: z.string().default("India"),
  address: z.string().default(""),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  website: z.string().nullable().default(null),
  mapsUrl: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  rating: z.number().nullable().default(null),
  reviewCount: z.number().nullable().default(0),
  socialLinks: z.record(z.string(), z.string()).default({}),
  discoverySource: z.enum([
    "GOOGLE_PLACES",
    "WEB_SEARCH",
    "CSV_IMPORT",
    "MANUAL",
    "REFERRAL",
    "DEMO",
  ]),
  discoveredAt: iso,
  raw: z.record(z.string(), z.unknown()).default({}),
});
export type Business = z.infer<typeof BusinessSchema>;

export const LeadSchema = z.object({
  id: id,
  organizationId: id,
  businessId: id,
  status: LeadStatus.default("DISCOVERED"),
  pipelineStage: PipelineStage.default("Discovered"),
  priority: Priority.nullable().default(null),
  score: z.number().min(0).max(100).nullable().default(null),
  websiteStatus: WebsiteStatus.default("UNKNOWN"),
  assignedTo: id.nullable().default(null),
  tags: z.array(z.string()).default([]),
  optOut: z.boolean().default(false),
  suppressed: z.boolean().default(false),
  lastContactedAt: iso.nullable().default(null),
  nextFollowUpAt: iso.nullable().default(null),
  lostReason: z.string().nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type Lead = z.infer<typeof LeadSchema>;

export const ResearchReportSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id,
  businessId: id,
  summary: z.string(),
  services: z.array(z.string()).default([]),
  targetCustomer: z.string().default(""),
  onlinePresence: z.array(z.string()).default([]),
  contactChannels: z.array(z.string()).default([]),
  socialActivity: z.string().default(""),
  existingWebsite: z.string().default(""),
  businessMaturity: z.enum(["NEW", "GROWING", "ESTABLISHED", "MATURE", "UNKNOWN"]).default("UNKNOWN"),
  digitalOpportunities: z.array(z.string()).default([]),
  differentiators: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  provider: z.string().default("local"),
  model: z.string().default(""),
  createdAt: iso,
});
export type ResearchReport = z.infer<typeof ResearchReportSchema>;

export const AuditFindingSchema = z.object({
  id: id,
  code: z.string(),
  label: z.string(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
  detail: z.string(),
  evidence: z.string().default(""),
  recommendation: z.string().default(""),
});
export type AuditFinding = z.infer<typeof AuditFindingSchema>;

export const WebsiteAuditSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id,
  url: z.string().nullable().default(null),
  auditedAt: iso,
  hasWebsite: z.boolean().default(false),
  reachable: z.boolean().default(false),
  https: z.boolean().default(false),
  statusCode: z.number().nullable().default(null),
  loadTimeMs: z.number().nullable().default(null),
  mobileResponsive: z.enum(["YES", "NO", "PARTIAL", "UNKNOWN"]).default("UNKNOWN"),
  navigationScore: z.number().min(0).max(100).default(0),
  visualHierarchyScore: z.number().min(0).max(100).default(0),
  designEra: z.enum(["NONE", "LEGACY", "DATED", "CURRENT", "MODERN", "UNKNOWN"]).default("UNKNOWN"),
  brokenPages: z.array(z.string()).default([]),
  hasContactCta: z.boolean().default(false),
  hasWhatsapp: z.boolean().default(false),
  hasForms: z.boolean().default(false),
  hasBooking: z.boolean().default(false),
  hasEcommerce: z.boolean().default(false),
  performanceScore: z.number().min(0).max(100).default(0),
  seoScore: z.number().min(0).max(100).default(0),
  accessibilityScore: z.number().min(0).max(100).default(0),
  hasMetadata: z.boolean().default(false),
  hasSocialLinks: z.boolean().default(false),
  trustElements: z.array(z.string()).default([]),
  conversionOpportunities: z.array(z.string()).default([]),
  findings: z.array(AuditFindingSchema).default([]),
  overallGrade: z.string().default(""),
  provider: z.string().default("local"),
  createdAt: iso,
});
export type WebsiteAudit = z.infer<typeof WebsiteAuditSchema>;

export const LeadScoreSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id,
  total: z.number().min(0).max(100),
  priority: Priority,
  factors: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      weight: z.number(),
      value: z.number(),
      contribution: z.number(),
      note: z.string().default(""),
    }),
  ),
  reasoning: z.string().default(""),
  evidenceStrength: z.number().min(0).max(1).default(0.5),
  scoredBy: z.string().default("scorer"),
  createdAt: iso,
});
export type LeadScore = z.infer<typeof LeadScoreSchema>;

export const OpportunitySchema = z.object({
  id: id,
  organizationId: id,
  leadId: id,
  serviceKey: z.string().default("business-website"),
  headline: z.string(),
  problem: z.string(),
  proposedSolution: z.string(),
  estimatedValue: z.number().default(0),
  estimatedEffortHours: z.number().default(0),
  confidence: z.number().min(0).max(1).default(0.5),
  createdAt: iso,
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

export const StrategySectionSchema = z.object({
  id: id,
  component: z.string(),
  heading: z.string(),
  purpose: z.string(),
  content: z.record(z.string(), z.unknown()).default({}),
});
export type StrategySection = z.infer<typeof StrategySectionSchema>;

export const WebsiteStrategySchema = z.object({
  id: id,
  organizationId: id,
  leadId: id,
  templateFamily: z.string(),
  serviceKey: z.string(),
  pages: z.array(z.string()),
  sections: z.array(StrategySectionSchema),
  theme: z.object({
    palette: z.string(),
    primary: z.string(),
    accent: z.string(),
    neutral: z.string(),
    fontHeading: z.string(),
    fontBody: z.string(),
    radius: z.string(),
    mood: z.string(),
  }),
  copyDirection: z.string(),
  conversionGoals: z.array(z.string()),
  mustHaveFeatures: z.array(z.string()),
  seoKeywords: z.array(z.string()),
  rationale: z.string(),
  provider: z.string().default("local"),
  createdAt: iso,
});
export type WebsiteStrategy = z.infer<typeof WebsiteStrategySchema>;

export const DemoSiteSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id,
  strategyId: id.nullable().default(null),
  slug: z.string(),
  businessName: z.string(),
  templateFamily: z.string(),
  serviceKey: z.string(),
  status: z.enum(["QUEUED", "GENERATING", "GENERATED", "QA_FAILED", "DEPLOYED", "FAILED"]),
  pages: z.array(z.string()),
  outputDir: z.string(),
  previewUrl: z.string(),
  theme: z.record(z.string(), z.unknown()).default({}),
  fileCount: z.number().default(0),
  totalBytes: z.number().default(0),
  generatedBy: z.string().default("builder"),
  error: z.string().nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type DemoSite = z.infer<typeof DemoSiteSchema>;

export const QaCheckSchema = z.object({
  id: id,
  code: z.string(),
  label: z.string(),
  category: z.enum([
    "BUILD",
    "TYPES",
    "LINT",
    "CONSOLE",
    "ASSETS",
    "ROUTES",
    "LINKS",
    "FORMS",
    "MOBILE",
    "TABLET",
    "DESKTOP",
    "OVERFLOW",
    "A11Y",
    "METADATA",
    "PERFORMANCE",
  ]),
  passed: z.boolean(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
  message: z.string(),
  target: z.string().default(""),
});
export type QaCheck = z.infer<typeof QaCheckSchema>;

export const QaRunSchema = z.object({
  id: id,
  organizationId: id,
  targetType: z.enum(["DEMO", "BUILD"]),
  targetId: id,
  verdict: QaVerdict,
  score: z.number().min(0).max(100),
  checks: z.array(QaCheckSchema),
  passedCount: z.number(),
  failedCount: z.number(),
  warningCount: z.number(),
  durationMs: z.number(),
  issues: z.array(z.string()).default([]),
  runBy: z.string().default("qa"),
  createdAt: iso,
});
export type QaRun = z.infer<typeof QaRunSchema>;

export const DeploymentSchema = z.object({
  id: id,
  organizationId: id,
  targetType: z.enum(["DEMO", "BUILD"]),
  targetId: id,
  projectId: id.nullable().default(null),
  kind: DeploymentKind,
  state: DeploymentState,
  url: z.string(),
  provider: z.string().default("local"),
  providerRef: z.string().default(""),
  branch: z.string().default("main"),
  commitSha: z.string().default(""),
  buildLog: z.string().default(""),
  healthCheck: z.enum(["UNKNOWN", "HEALTHY", "DEGRADED", "DOWN"]).default("UNKNOWN"),
  customDomain: z.string().nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type Deployment = z.infer<typeof DeploymentSchema>;

export const CampaignSchema = z.object({
  id: id,
  organizationId: id,
  name: z.string(),
  channel: OutreachChannel.default("EMAIL"),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
  dailyLimit: z.number().default(20),
  sentToday: z.number().default(0),
  totalTargets: z.number().default(0),
  createdAt: iso,
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const OutreachMessageSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id,
  campaignId: id.nullable().default(null),
  channel: OutreachChannel.default("EMAIL"),
  status: OutreachStatus.default("DRAFT"),
  subject: z.string().default(""),
  body: z.string(),
  personalization: z.array(z.string()).default([]),
  toAddress: z.string().default(""),
  providerMessageId: z.string().nullable().default(null),
  threadId: z.string().nullable().default(null),
  riskLevel: RiskLevel.default("MEDIUM"),
  approvalRequired: z.boolean().default(true),
  approvedBy: id.nullable().default(null),
  sentAt: iso.nullable().default(null),
  openedAt: iso.nullable().default(null),
  repliedAt: iso.nullable().default(null),
  error: z.string().nullable().default(null),
  createdBy: z.string().default("outreach"),
  createdAt: iso,
  updatedAt: iso,
});
export type OutreachMessage = z.infer<typeof OutreachMessageSchema>;

export const MessageSchema = z.object({
  id: id,
  organizationId: id,
  conversationId: id,
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  channel: OutreachChannel.default("EMAIL"),
  fromAddress: z.string().default(""),
  toAddress: z.string().default(""),
  subject: z.string().default(""),
  body: z.string(),
  intent: MessageIntent.nullable().default(null),
  intentConfidence: z.number().nullable().default(null),
  suggestedReply: z.string().nullable().default(null),
  isFromAgent: z.boolean().default(false),
  agentKey: AgentKey.nullable().default(null),
  readAt: iso.nullable().default(null),
  createdAt: iso,
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id.nullable().default(null),
  clientId: id.nullable().default(null),
  subject: z.string(),
  channel: OutreachChannel.default("EMAIL"),
  state: ConversationState.default("OPEN"),
  lastIntent: MessageIntent.nullable().default(null),
  unreadCount: z.number().default(0),
  assignedTo: id.nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ProposalItemSchema = z.object({
  id: id,
  proposalId: id,
  label: z.string(),
  description: z.string().default(""),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
  amount: z.number().default(0),
  kind: z.enum(["BASE", "ADDON", "PAGE", "MAINTENANCE", "DISCOUNT"]).default("BASE"),
});
export type ProposalItem = z.infer<typeof ProposalItemSchema>;

export const ProposalSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id.nullable().default(null),
  clientId: id.nullable().default(null),
  number: z.string(),
  status: ProposalStatus.default("DRAFT"),
  title: z.string(),
  projectSummary: z.string(),
  problem: z.string(),
  proposedSolution: z.string(),
  pages: z.array(z.string()).default([]),
  functionality: z.array(z.string()).default([]),
  deliverables: z.array(z.string()).default([]),
  milestones: z
    .array(
      z.object({
        id: id,
        name: z.string(),
        description: z.string().default(""),
        days: z.number().default(0),
        amount: z.number().default(0),
        status: z.enum(["PENDING", "IN_PROGRESS", "DONE"]).default("PENDING"),
      }),
    )
    .default([]),
  subtotal: z.number().default(0),
  discount: z.number().default(0),
  total: z.number().default(0),
  currency: z.string().default("INR"),
  validUntil: iso.nullable().default(null),
  revisionPolicy: z.string().default(""),
  maintenanceTerms: z.string().default(""),
  hostingTerms: z.string().default(""),
  termsPlaceholder: z.string().default(""),
  upgradeOptions: z
    .array(z.object({ id: id, label: z.string(), price: z.number().default(0) }))
    .default([]),
  createdBy: z.string().default("proposal"),
  sentAt: iso.nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type Proposal = z.infer<typeof ProposalSchema>;

export const ClientContactSchema = z.object({
  id: id,
  clientId: id,
  name: z.string(),
  role: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  isPrimary: z.boolean().default(false),
});
export type ClientContact = z.infer<typeof ClientContactSchema>;

export const ClientSchema = z.object({
  id: id,
  organizationId: id,
  leadId: id.nullable().default(null),
  businessId: id.nullable().default(null),
  name: z.string(),
  slug: z.string(),
  status: z.enum(["ONBOARDING", "ACTIVE", "PAUSED", "CHURNED"]).default("ONBOARDING"),
  lifetimeValue: z.number().default(0),
  monthlyRecurring: z.number().default(0),
  contractValue: z.number().default(0),
  onboardingProgress: z.number().min(0).max(100).default(0),
  primaryEmail: z.string().default(""),
  primaryPhone: z.string().default(""),
  createdAt: iso,
  updatedAt: iso,
});
export type Client = z.infer<typeof ClientSchema>;

export const OnboardingSubmissionSchema = z.object({
  id: id,
  organizationId: id,
  clientId: id,
  status: z.enum(["PENDING", "PARTIAL", "COMPLETE"]).default("PENDING"),
  completion: z.number().min(0).max(100).default(0),
  data: z.object({
    companyName: z.string().default(""),
    logoUrl: z.string().default(""),
    brandColors: z.array(z.string()).default([]),
    businessDescription: z.string().default(""),
    services: z.array(z.string()).default([]),
    socialUrls: z.record(z.string(), z.string()).default({}),
    phone: z.string().default(""),
    email: z.string().default(""),
    address: z.string().default(""),
    images: z.array(z.string()).default([]),
    productInfo: z.string().default(""),
    preferredFeatures: z.array(z.string()).default([]),
    inspiration: z.array(z.string()).default([]),
    domain: z.string().default(""),
    domainProvider: z.string().default(""),
    notes: z.string().default(""),
  }),
  missing: z.array(z.string()).default([]),
  submittedAt: iso.nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type OnboardingSubmission = z.infer<typeof OnboardingSubmissionSchema>;

export const ProjectRequirementSchema = z.object({
  id: id,
  projectId: id,
  title: z.string(),
  detail: z.string().default(""),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"]).default("OPEN"),
  source: z.enum(["PROPOSAL", "ONBOARDING", "STRATEGY", "CLIENT", "AGENT"]).default("PROPOSAL"),
  createdAt: iso,
});
export type ProjectRequirement = z.infer<typeof ProjectRequirementSchema>;

export const ProjectSchema = z.object({
  id: id,
  organizationId: id,
  clientId: id,
  proposalId: id.nullable().default(null),
  strategyId: id.nullable().default(null),
  name: z.string(),
  slug: z.string(),
  serviceKey: z.string(),
  stage: ProjectStage.default("Planning"),
  progress: z.number().min(0).max(100).default(0),
  repositoryUrl: z.string().nullable().default(null),
  previewUrl: z.string().nullable().default(null),
  productionUrl: z.string().nullable().default(null),
  dueDate: iso.nullable().default(null),
  value: z.number().default(0),
  repoProvider: z.string().default("github"),
  createdAt: iso,
  updatedAt: iso,
});
export type Project = z.infer<typeof ProjectSchema>;

export const WebsiteBuildSchema = z.object({
  id: id,
  organizationId: id,
  projectId: id,
  strategyId: id.nullable().default(null),
  version: z.number().default(1),
  status: z.enum(["QUEUED", "BUILDING", "BUILT", "QA_FAILED", "READY", "FAILED"]),
  outputDir: z.string(),
  pages: z.array(z.string()).default([]),
  componentsUsed: z.array(z.string()).default([]),
  fileCount: z.number().default(0),
  totalBytes: z.number().default(0),
  builtBy: z.string().default("production_builder"),
  error: z.string().nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type WebsiteBuild = z.infer<typeof WebsiteBuildSchema>;

export const SupportTicketSchema = z.object({
  id: id,
  organizationId: id,
  clientId: id.nullable().default(null),
  projectId: id.nullable().default(null),
  subject: z.string(),
  category: TicketCategory.default("unknown"),
  status: TicketStatus.default("OPEN"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  description: z.string().default(""),
  resolution: z.string().default(""),
  isUpsell: z.boolean().default(false),
  upsellOpportunityId: id.nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type SupportTicket = z.infer<typeof SupportTicketSchema>;

export const UpsellOpportunitySchema = z.object({
  id: id,
  organizationId: id,
  clientId: id,
  ticketId: id.nullable().default(null),
  title: z.string(),
  rationale: z.string().default(""),
  serviceKey: z.string().default(""),
  estimatedValue: z.number().default(0),
  status: z.enum(["NEW", "PRESENTED", "ACCEPTED", "DECLINED", "EXPIRED"]).default("NEW"),
  createdAt: iso,
});
export type UpsellOpportunity = z.infer<typeof UpsellOpportunitySchema>;

export const AgentDefinitionSchema = z.object({
  id: id,
  organizationId: id,
  key: AgentKey,
  name: z.string(),
  purpose: z.string(),
  description: z.string().default(""),
  icon: z.string().default("bot"),
  state: AgentState.default("IDLE"),
  permissionLevel: PermissionLevel.default("GREEN"),
  model: z.string().default("local-deterministic"),
  provider: z.string().default("local"),
  tools: z.array(z.string()).default([]),
  config: z.record(z.string(), z.unknown()).default({}),
  runsToday: z.number().default(0),
  successRate: z.number().default(1),
  avgExecutionMs: z.number().default(0),
  lastRunAt: iso.nullable().default(null),
  currentTaskId: id.nullable().default(null),
  currentTaskLabel: z.string().nullable().default(null),
  consecutiveFailures: z.number().default(0),
  paused: z.boolean().default(false),
  createdAt: iso,
  updatedAt: iso,
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

export const AgentRunSchema = z.object({
  id: id,
  organizationId: id,
  agentKey: AgentKey,
  taskId: id.nullable().default(null),
  trigger: z.enum(["EVENT", "MANUAL", "SCHEDULE", "RETRY", "SUPERVISOR"]).default("MANUAL"),
  status: TaskStatus,
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).default({}),
  error: z.string().nullable().default(null),
  durationMs: z.number().default(0),
  tokensIn: z.number().default(0),
  tokensOut: z.number().default(0),
  costUsd: z.number().default(0),
  startedAt: iso,
  completedAt: iso.nullable().default(null),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const AgentTaskSchema = z.object({
  id: id,
  organizationId: id,
  agentKey: AgentKey,
  type: z.string(),
  entityType: z.string().default(""),
  entityId: id.default(""),
  priority: TaskPriority.default("NORMAL"),
  input: z.record(z.string(), z.unknown()).default({}),
  status: TaskStatus.default("QUEUED"),
  progress: z.number().min(0).max(100).default(0),
  output: z.record(z.string(), z.unknown()).default({}),
  error: z.string().nullable().default(null),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(2),
  riskLevel: RiskLevel.default("LOW"),
  approvalId: id.nullable().default(null),
  createdAt: iso,
  startedAt: iso.nullable().default(null),
  completedAt: iso.nullable().default(null),
});
export type AgentTask = z.infer<typeof AgentTaskSchema>;

export const AgentLogSchema = z.object({
  id: id,
  organizationId: id,
  agentKey: AgentKey.nullable().default(null),
  runId: id.nullable().default(null),
  taskId: id.nullable().default(null),
  level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO"),
  message: z.string(),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: iso,
});
export type AgentLog = z.infer<typeof AgentLogSchema>;

export const ApprovalRequestSchema = z.object({
  id: id,
  organizationId: id,
  action: z.string(),
  title: z.string(),
  reason: z.string().default(""),
  requestingAgent: AgentKey,
  entityType: z.string().default(""),
  entityId: id.default(""),
  riskLevel: RiskLevel.default("MEDIUM"),
  permissionLevel: PermissionLevel.default("YELLOW"),
  status: ApprovalStatus.default("PENDING"),
  payload: z.record(z.string(), z.unknown()).default({}),
  diff: z.record(z.string(), z.unknown()).default({}),
  decisionNote: z.string().nullable().default(null),
  decidedBy: id.nullable().default(null),
  decidedAt: iso.nullable().default(null),
  expiresAt: iso.nullable().default(null),
  createdAt: iso,
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ActivityEventSchema = z.object({
  id: id,
  organizationId: id,
  agentKey: AgentKey.nullable().default(null),
  actorType: z.enum(["AGENT", "USER", "SYSTEM"]).default("AGENT"),
  actionType: z.string(),
  title: z.string(),
  detail: z.string().default(""),
  entityType: z.string().default(""),
  entityId: id.default(""),
  leadId: id.nullable().default(null),
  clientId: id.nullable().default(null),
  projectId: id.nullable().default(null),
  riskLevel: RiskLevel.default("LOW"),
  status: z.enum(["OK", "PENDING", "WARN", "ERROR"]).default("OK"),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: iso,
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const NotificationSchema = z.object({
  id: id,
  organizationId: id,
  type: z.string(),
  title: z.string(),
  body: z.string().default(""),
  entityType: z.string().default(""),
  entityId: id.default(""),
  href: z.string().nullable().default(null),
  severity: z.enum(["INFO", "SUCCESS", "WARNING", "DANGER"]).default("INFO"),
  read: z.boolean().default(false),
  createdAt: iso,
});
export type Notification = z.infer<typeof NotificationSchema>;

export const IntegrationSchema = z.object({
  id: id,
  organizationId: id,
  key: z.string(),
  name: z.string(),
  category: z.enum(["AI", "LEADS", "EMAIL", "WHATSAPP", "GIT", "DEPLOY", "DATABASE", "PAYMENTS", "STORAGE"]),
  status: IntegrationStatus.default("NOT_CONNECTED"),
  detail: z.string().default(""),
  docsUrl: z.string().default(""),
  requiredEnv: z.array(z.string()).default([]),
  optionalEnv: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  lastCheckedAt: iso.nullable().default(null),
  updatedAt: iso,
});
export type Integration = z.infer<typeof IntegrationSchema>;

export const IntegrationCredentialMetadataSchema = z.object({
  id: id,
  organizationId: id,
  integrationKey: z.string(),
  label: z.string(),
  // NEVER store the raw secret. Only metadata about it.
  fingerprint: z.string(),
  lastFour: z.string().default(""),
  scopes: z.array(z.string()).default([]),
  rotatedAt: iso.nullable().default(null),
  createdBy: id,
  createdAt: iso,
});
export type IntegrationCredentialMetadata = z.infer<typeof IntegrationCredentialMetadataSchema>;

export const AuditLogSchema = z.object({
  id: id,
  organizationId: id,
  actorType: z.enum(["AGENT", "USER", "SYSTEM"]),
  actorId: id.default(""),
  actorLabel: z.string().default(""),
  action: z.string(),
  entityType: z.string().default(""),
  entityId: id.default(""),
  before: z.record(z.string(), z.unknown()).default({}),
  after: z.record(z.string(), z.unknown()).default({}),
  ip: z.string().default(""),
  createdAt: iso,
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const RevenueEventSchema = z.object({
  id: id,
  organizationId: id,
  clientId: id.nullable().default(null),
  projectId: id.nullable().default(null),
  proposalId: id.nullable().default(null),
  kind: z.enum(["PROJECT_FEE", "MAINTENANCE", "ADDON", "HOSTING", "REFUND"]),
  amount: z.number(),
  currency: z.string().default("INR"),
  status: z.enum(["PENDING", "INVOICED", "PAID", "REFUNDED", "CANCELLED"]).default("PENDING"),
  description: z.string().default(""),
  occurredAt: iso,
  createdAt: iso,
});
export type RevenueEvent = z.infer<typeof RevenueEventSchema>;

export const ServiceSchema = z.object({
  id: id,
  organizationId: id,
  key: z.string(),
  name: z.string(),
  description: z.string().default(""),
  basePrice: z.number().default(0),
  estimatedDeliveryDays: z.number().default(14),
  features: z.array(z.string()).default([]),
  upgrades: z.array(z.object({ id: id, label: z.string(), price: z.number().default(0) })).default([]),
  active: z.boolean().default(true),
  createdAt: iso,
  updatedAt: iso,
});
export type Service = z.infer<typeof ServiceSchema>;

export const PricingRuleSchema = z.object({
  id: id,
  organizationId: id,
  key: z.string(),
  label: z.string(),
  kind: z.enum(["PAGE", "FEATURE", "RUSH", "MAINTENANCE", "DISCOUNT", "BASE"]),
  price: z.number().default(0),
  unit: z.enum(["FLAT", "PER_PAGE", "PER_MONTH", "PERCENT"]).default("FLAT"),
  active: z.boolean().default(true),
  maxDiscountPercent: z.number().default(15),
  description: z.string().default(""),
});
export type PricingRule = z.infer<typeof PricingRuleSchema>;

export const SettingsSchema = z.object({
  id: id,
  organizationId: id,
  automation: z.object({
    leadDiscovery: z.boolean().default(false),
    automaticResearch: z.boolean().default(true),
    automaticAudit: z.boolean().default(true),
    automaticScoring: z.boolean().default(true),
    automaticDemoCreation: z.boolean().default(false),
    automaticQa: z.boolean().default(true),
    automaticPreviewDeployment: z.boolean().default(true),
    automaticOutreachDraft: z.boolean().default(true),
    automaticOutreachSending: z.boolean().default(false),
    automaticFollowUp: z.boolean().default(false),
    automaticReplySuggestions: z.boolean().default(true),
    automaticProposalDrafts: z.boolean().default(true),
    automaticMinorMaintenance: z.boolean().default(false),
  }),
  permissions: z.object({
    allowAutoOutreach: z.boolean().default(false),
    allowAutoReplies: z.boolean().default(false),
    allowAutoFollowUps: z.boolean().default(false),
    allowAutoMinorEdits: z.boolean().default(false),
    allowAutoPreviewUpdates: z.boolean().default(true),
  }),
  outreach: z.object({
    dailyLimit: z.number().default(20),
    followUpDelayDays: z.number().default(3),
    maxFollowUps: z.number().default(2),
    defaultChannel: OutreachChannel.default("EMAIL"),
    requireApproval: z.boolean().default(true),
    signature: z.string().default(""),
  }),
  leadSources: z.object({
    googlePlaces: z.boolean().default(true),
    webSearch: z.boolean().default(false),
    csvImport: z.boolean().default(true),
    manual: z.boolean().default(true),
    defaultCities: z.array(z.string()).default([]),
    defaultCategories: z.array(z.string()).default([]),
  }),
  ai: z.object({
    provider: z.string().default("local"),
    model: z.string().default("local-deterministic"),
    temperature: z.number().default(0.4),
    maxTokens: z.number().default(2048),
    fallbackToLocal: z.boolean().default(true),
  }),
  company: z.object({
    agencyName: z.string().default("NEXORA"),
    ownerName: z.string().default("Sajid Raza"),
    website: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    address: z.string().default(""),
    gstin: z.string().default(""),
  }),
  autonomy: z.object({
    paused: z.boolean().default(false),
    pausedAt: iso.nullable().default(null),
    pauseOutreach: z.boolean().default(false),
    pauseDemos: z.boolean().default(false),
    pauseDeployments: z.boolean().default(false),
  }),
  notifications: z.object({
    hotLead: z.boolean().default(true),
    prospectReply: z.boolean().default(true),
    proposalRequested: z.boolean().default(true),
    approvalRequired: z.boolean().default(true),
    paymentEvent: z.boolean().default(true),
    buildCompleted: z.boolean().default(true),
    qaFailed: z.boolean().default(true),
    deploymentFailed: z.boolean().default(true),
    newClient: z.boolean().default(true),
    supportIssue: z.boolean().default(true),
  }),
  updatedAt: iso,
});
export type Settings = z.infer<typeof SettingsSchema>;

/* ---------------------------------------------------------------- tables --- */

export const DatabaseSchema = z.object({
  version: z.number().default(1),
  organizations: z.array(OrganizationSchema).default([]),
  users: z.array(UserSchema).default([]),
  organization_members: z.array(OrganizationMemberSchema).default([]),
  settings: z.array(SettingsSchema).default([]),
  businesses: z.array(BusinessSchema).default([]),
  business_contacts: z.array(BusinessContactSchema).default([]),
  leads: z.array(LeadSchema).default([]),
  research_reports: z.array(ResearchReportSchema).default([]),
  website_audits: z.array(WebsiteAuditSchema).default([]),
  lead_scores: z.array(LeadScoreSchema).default([]),
  opportunities: z.array(OpportunitySchema).default([]),
  strategies: z.array(WebsiteStrategySchema).default([]),
  demo_sites: z.array(DemoSiteSchema).default([]),
  qa_runs: z.array(QaRunSchema).default([]),
  deployments: z.array(DeploymentSchema).default([]),
  campaigns: z.array(CampaignSchema).default([]),
  outreach_messages: z.array(OutreachMessageSchema).default([]),
  conversations: z.array(ConversationSchema).default([]),
  messages: z.array(MessageSchema).default([]),
  proposals: z.array(ProposalSchema).default([]),
  proposal_items: z.array(ProposalItemSchema).default([]),
  clients: z.array(ClientSchema).default([]),
  client_contacts: z.array(ClientContactSchema).default([]),
  onboarding_submissions: z.array(OnboardingSubmissionSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  project_requirements: z.array(ProjectRequirementSchema).default([]),
  website_builds: z.array(WebsiteBuildSchema).default([]),
  support_tickets: z.array(SupportTicketSchema).default([]),
  upsell_opportunities: z.array(UpsellOpportunitySchema).default([]),
  agent_definitions: z.array(AgentDefinitionSchema).default([]),
  agent_runs: z.array(AgentRunSchema).default([]),
  agent_tasks: z.array(AgentTaskSchema).default([]),
  agent_logs: z.array(AgentLogSchema).default([]),
  approval_requests: z.array(ApprovalRequestSchema).default([]),
  activity_events: z.array(ActivityEventSchema).default([]),
  notifications: z.array(NotificationSchema).default([]),
  integrations: z.array(IntegrationSchema).default([]),
  integration_credentials_metadata: z.array(IntegrationCredentialMetadataSchema).default([]),
  audit_logs: z.array(AuditLogSchema).default([]),
  revenue_events: z.array(RevenueEventSchema).default([]),
  services: z.array(ServiceSchema).default([]),
  pricing_rules: z.array(PricingRuleSchema).default([]),
});
export type Database = z.infer<typeof DatabaseSchema>;

export type TableName = keyof Omit<Database, "version">;

export const TABLE_NAMES = Object.keys(DatabaseSchema.shape).filter(
  (k) => k !== "version",
) as TableName[];

/** Row type lookup */
export type Row<T extends TableName> = NonNullable<Database[T][number]>;
