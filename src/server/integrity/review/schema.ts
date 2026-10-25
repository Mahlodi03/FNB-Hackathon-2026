import { z } from "zod";

export const ReviewDecisionSchema = z.enum(["cleared", "needs_investigation", "withheld"]);

export const IntegrityReviewRequestSchema = z.object({
  attemptId: z.string().uuid(),
  decision: ReviewDecisionSchema,
  reason: z.string().trim().min(20).max(2000),
}).strict();

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export const reviewLabels: Record<ReviewDecision, string> = {
  cleared: "Cleared by reviewer",
  needs_investigation: "Further investigation",
  withheld: "Evidence withheld",
};

/** The outcome is about publication, never changing scores or declaring guilt. */
export function eligibleVisibility(decision: ReviewDecision, passed: boolean, gradingSource: string) {
  if (decision !== "cleared") return "withheld" as const;
  return passed && gradingSource === "ai_assisted" ? "published" as const : "provisional" as const;
}
