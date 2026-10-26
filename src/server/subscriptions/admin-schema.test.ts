import { describe, expect, it } from "vitest";
import { DemoEntitlementSchema } from "./admin-schema";

const userId = "10000000-0000-4000-8000-000000000001";
describe("admin demo entitlement input", () => {
  it("accepts a 30-day grant", () => {
    expect(DemoEntitlementSchema.safeParse({ userId, action: "grant", days: 30 }).success).toBe(true);
  });
  it("allows revocation without a duration", () => {
    expect(DemoEntitlementSchema.safeParse({ userId, action: "revoke" }).success).toBe(true);
  });
  it("rejects unreasonable durations", () => {
    expect(DemoEntitlementSchema.safeParse({ userId, action: "grant", days: 0 }).success).toBe(false);
    expect(DemoEntitlementSchema.safeParse({ userId, action: "grant", days: 91 }).success).toBe(false);
  });
  it("rejects an invalid account or unknown action", () => {
    expect(DemoEntitlementSchema.safeParse({ userId: "not-a-uuid", action: "grant", days: 30 }).success).toBe(false);
    expect(DemoEntitlementSchema.safeParse({ userId, action: "paid" }).success).toBe(false);
  });
});
