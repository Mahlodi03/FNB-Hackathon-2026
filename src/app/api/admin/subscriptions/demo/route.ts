import { AccessError, requireActor } from "@/server/auth/actor";
import { serviceSupabase } from "@/lib/supabase/admin";
import { DemoEntitlementSchema } from "@/server/subscriptions/admin-schema";

/** Admin-only demonstration grants. Does not process a payment. */
export async function POST(request: Request) {
  try {
    const actor = await requireActor(["admin"]);
    const parsed = DemoEntitlementSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid demo entitlement request" }, { status: 400 });

    const { data, error } = await serviceSupabase().rpc("set_demo_entitlement", {
      p_admin_id: actor.userId,
      p_user_id: parsed.data.userId,
      p_action: parsed.data.action,
      p_days: parsed.data.action === "grant" ? parsed.data.days : 30,
    });
    if (error) {
      // Avoid leaking profile details or internal privilege errors.
      console.error("Demo entitlement update failed:", error);
      return Response.json({ error: "Unable to change the demo entitlement" }, { status: 400 });
    }
    return Response.json({ result: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Demo entitlement request failed:", error);
    return Response.json({ error: "Unable to update demo entitlement" }, { status: 500 });
  }
}
