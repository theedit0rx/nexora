import { db } from "@/lib/db";
import { nowIso, type ProposalStatus } from "@/lib/db/schema";
import { logActivity } from "@/lib/events/bus";
import { fail, handler, json, readBody } from "@/lib/api";

export const dynamic = "force-dynamic";

const ALLOWED: ProposalStatus[] = ["DRAFT", "WAITING_APPROVAL", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];

export const POST = handler(async (ctx, req, params) => {
  const proposal = await db.byId("proposals", params.id);
  if (!proposal || proposal.organizationId !== ctx.session.organizationId) return fail("Proposal not found", 404);
  const body = await readBody<{ status?: ProposalStatus }>(req);
  if (!body.status || !ALLOWED.includes(body.status)) return fail("Invalid proposal status", 400);

  const updated = await db.update("proposals", proposal.id, {
    status: body.status,
    sentAt: body.status === "SENT" ? nowIso() : proposal.sentAt,
    updatedAt: nowIso(),
  });

  await logActivity({
    organizationId: ctx.session.organizationId,
    actorType: "USER",
    agentKey: "proposal",
    actionType: `proposal.${body.status.toLowerCase()}`,
    title: `Proposal ${proposal.number} marked ${body.status}`,
    detail: proposal.title,
    entityType: "proposal",
    entityId: proposal.id,
    leadId: proposal.leadId,
    status: body.status === "REJECTED" ? "WARN" : "OK",
    riskLevel: body.status === "ACCEPTED" ? "MEDIUM" : "LOW",
  });

  // Accepting a proposal creates the client + project skeleton.
  if (body.status === "ACCEPTED") {
    await convertToClient(ctx.session.organizationId, proposal.id);
  }

  return json({ ok: true, proposal: updated });
});

async function convertToClient(organizationId: string, proposalId: string) {
  const proposal = await db.byId("proposals", proposalId);
  if (!proposal || !proposal.leadId) return;
  const existing = await db.findOne("clients", { leadId: proposal.leadId });
  if (existing) return;

  const lead = await db.byId("leads", proposal.leadId);
  if (!lead) return;
  const business = await db.byId("businesses", lead.businessId);
  if (!business) return;

  const { newId, slugify } = await import("@/lib/db");
  const client = await db.insert("clients", {
    id: newId("clt"),
    organizationId,
    leadId: lead.id,
    businessId: business.id,
    name: business.name,
    slug: slugify(business.name),
    status: "ONBOARDING",
    lifetimeValue: proposal.total,
    monthlyRecurring: 0,
    contractValue: proposal.total,
    onboardingProgress: 0,
    primaryEmail: business.email ?? "",
    primaryPhone: business.phone ?? "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await db.update("proposals", proposal.id, { clientId: client.id });

  await db.insert("onboarding_submissions", {
    id: newId("onb"),
    organizationId,
    clientId: client.id,
    status: "PENDING",
    completion: 0,
    data: {
      companyName: business.name,
      logoUrl: "",
      brandColors: [],
      businessDescription: "",
      services: [],
      socialUrls: business.socialLinks,
      phone: business.phone ?? "",
      email: business.email ?? "",
      address: business.address,
      images: [],
      productInfo: "",
      preferredFeatures: [],
      inspiration: [],
      domain: "",
      domainProvider: "",
      notes: "",
    },
    missing: [
      "Logo",
      "Brand colours",
      "Business description",
      "Services list",
      "Images",
      "Product / service information",
      "Preferred features",
      "Website inspiration",
      "Domain information",
    ],
    submittedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  const project = await db.insert("projects", {
    id: newId("prj"),
    organizationId,
    clientId: client.id,
    proposalId: proposal.id,
    strategyId: null,
    name: `${business.name} website`,
    slug: `${slugify(business.name)}-site`,
    serviceKey: proposal.title.includes("Ecommerce") ? "ecommerce" : "business-website",
    stage: "Planning",
    progress: 5,
    repositoryUrl: null,
    previewUrl: null,
    productionUrl: null,
    dueDate: new Date(Date.now() + 21 * 864e5).toISOString(),
    value: proposal.total,
    repoProvider: "github",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await db.insert("revenue_events", {
    id: newId("rev"),
    organizationId,
    clientId: client.id,
    projectId: project.id,
    proposalId: proposal.id,
    kind: "PROJECT_FEE",
    amount: proposal.total,
    currency: proposal.currency,
    status: "INVOICED",
    description: `Proposal ${proposal.number} accepted`,
    occurredAt: nowIso(),
    createdAt: nowIso(),
  });

  await logActivity({
    organizationId,
    agentKey: "onboarding",
    actionType: "client.created",
    title: `${business.name} became a client`,
    detail: `Onboarding started · project ${project.name} created`,
    entityType: "client",
    entityId: client.id,
    clientId: client.id,
    projectId: project.id,
    status: "OK",
    riskLevel: "MEDIUM",
  });
}
