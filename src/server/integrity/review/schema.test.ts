import { describe, expect, it } from "vitest";
import { IntegrityReviewRequestSchema, eligibleVisibility } from "./schema";

const request = {
  attemptId: "10000000-0000-4000-8000-000000000001",
  decision: "cleared",
  reason: "The recorded events were reviewed in context with the student.",
};

describe("human integrity review validation", () => {
  it("accepts the documented decisions and meaningful reasons", () => {
    for (const decision of ["cleared", "needs_investigation", "withheld"]) {
      expect(IntegrityReviewRequestSchema.safeParse({ ...request, decision }).success).toBe(true);
    }
  });
  it("rejects short reasons, unauthorized fields and unknown decisions", () => {
    expect(IntegrityReviewRequestSchema.safeParse({ ...request, reason: "Too short" }).success).toBe(false);
    expect(IntegrityReviewRequestSchema.safeParse({ ...request, reviewerId: request.attemptId }).success).toBe(false);
    expect(IntegrityReviewRequestSchema.safeParse({ ...request, decision: "auto_flag" }).success).toBe(false);
  });
  it("never publishes investigation or withheld evidence", () => {
    expect(eligibleVisibility("needs_investigation", true, "ai_assisted")).toBe("withheld");
    expect(eligibleVisibility("withheld", true, "ai_assisted")).toBe("withheld");
  });
  it("publishes cleared passing eligible results only", () => {
    expect(eligibleVisibility("cleared", true, "ai_assisted")).toBe("published");
    expect(eligibleVisibility("cleared", false, "ai_assisted")).toBe("provisional");
    expect(eligibleVisibility("cleared", true, "manual_review")).toBe("provisional");
  });
});
