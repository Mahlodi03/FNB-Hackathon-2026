import "server-only";
import { serviceSupabase } from "@/lib/supabase/admin";
import { FREE_CHALLENGE_LIMIT, planIsActive, remainingFreeUnlocks } from "./rules";

type EligibleRole = "student" | "employer";
export type PlanSummary = {
  role: EligibleRole;
  plan: "free" | "premium";
  source: "admin_demo" | null;
  premiumUntil: string | null;
  freeLimit: number | null;
  usedUnlocks: number | null;
  remainingUnlocks: number | null;
};

/** Only call after the current authenticated user's role has been verified. */
export async function getPlanSummary(userId: string, role: EligibleRole): Promise<PlanSummary> {
  const db = serviceSupabase();
  const { data: entitlement, error: entitlementError } = await db
    .from("account_entitlements")
    .select("plan, source, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (entitlementError) throw new Error("Unable to load subscription entitlement");

  const premium = entitlement?.plan === "premium" &&
    entitlement.source === "admin_demo" && planIsActive(entitlement.expires_at);
  let usedUnlocks: number | null = null;
  if (role === "student") {
    // Historic attempts are included, including ones started while Premium.
    // The unique student/task constraint guarantees one count per challenge.
    const { count, error } = await db.from("attempts")
      .select("id", { count: "exact", head: true }).eq("student_id", userId);
    if (error || count === null) throw new Error("Unable to count challenge unlocks");
    usedUnlocks = count;
  }
  return {
    role,
    plan: premium ? "premium" : "free",
    source: premium ? "admin_demo" : null,
    premiumUntil: premium ? entitlement.expires_at : null,
    freeLimit: role === "student" ? FREE_CHALLENGE_LIMIT : null,
    usedUnlocks,
    remainingUnlocks: usedUnlocks === null ? null : remainingFreeUnlocks(usedUnlocks),
  };
}
