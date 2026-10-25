import { AccessError, requireActor } from "@/server/auth/actor";
import { getPlanSummary } from "@/server/subscriptions/queries";

export async function GET() {
  try {
    const actor = await requireActor(["student", "employer"]);
    const summary = await getPlanSummary(actor.userId, actor.role as "student" | "employer");
    return Response.json(summary, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Subscription status lookup failed:", error);
    return Response.json({ error: "Unable to load your plan" }, { status: 503 });
  }
}
