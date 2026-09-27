import { ensureDemoOrganization, seedDemoData } from "@/lib/bootstrap";
import { logActivity } from "@/lib/events/bus";
import { handler, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handler(async (ctx) => {
  const org = await ensureDemoOrganization();
  const result = await seedDemoData(org.id, { reset: true });
  await logActivity({
    organizationId: org.id,
    actorType: "USER",
    actionType: "demo.reset",
    title: "Demo workspace reset",
    detail: `${result.leads} leads regenerated`,
    status: "OK",
  });
  return json({ ok: true, ...result });
});
