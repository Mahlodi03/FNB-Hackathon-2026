import { AccessError, requireActor } from "@/server/auth/actor";
import { serviceSupabase } from "@/lib/supabase/admin";
import { IntegrityReviewRequestSchema } from "@/server/integrity/review/schema";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(["admin"]);

    // Reject cross-origin browser requests and non-JSON form submissions.
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return Response.json({ error: "Cross-origin request denied" }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Expected JSON" }, { status: 415 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_192) {
      return Response.json({ error: "Request too large" }, { status: 413 });
    }
    const parsed = IntegrityReviewRequestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return Response.json({ error: "Invalid decision or reason (20–2000 characters required)" }, { status: 400 });
    }

    const db = serviceSupabase();
    // One privileged DB transaction updates result visibility AND appends audit.
    // The SQL function validates the administrator role and graded status again.
    const { data, error } = await db.rpc("record_integrity_review", {
      p_attempt_id: parsed.data.attemptId,
      p_reviewer_id: actor.userId,
      p_decision: parsed.data.decision,
      p_reason: parsed.data.reason,
    });
    if (error) {
      if (error.code === "P0002") {
        return Response.json({ error: "Only graded attempts can be reviewed" }, { status: 409 });
      }
      if (error.code === "22023") {
        return Response.json({ error: "Invalid decision or reason" }, { status: 400 });
      }
      console.error("Integrity review transaction failed:", error.code);
      return Response.json({ error: "Unable to save review decision" }, { status: 503 });
    }
    const outcome = (data ?? [])[0];
    if (!outcome) return Response.json({ error: "Review could not be confirmed" }, { status: 503 });
    return Response.json({ reviewId: outcome.review_id, visibility: outcome.visibility, reviewedAt: outcome.reviewed_at }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.error("Integrity review request failed", error);
    return Response.json({ error: "Review service unavailable" }, { status: 503 });
  }
}
