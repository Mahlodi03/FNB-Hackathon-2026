import { describe, expect, it } from "vitest";
import { canUnlockNewChallenge, planIsActive, remainingFreeUnlocks } from "./rules";

describe("subscription foundation — presentation rules (DB is authoritative)", () => {
  it("provides 10 free starts for a new student", () => {
    expect(remainingFreeUnlocks(0)).toBe(10);
    expect(canUnlockNewChallenge(0, false)).toBe(true);
  });
  it("locks the eleventh distinct challenge start", () => {
    expect(remainingFreeUnlocks(9)).toBe(1);
    expect(remainingFreeUnlocks(10)).toBe(0);
    expect(canUnlockNewChallenge(10, false)).toBe(false);
  });
  it("never displays negative remaining unlocks", () => {
    expect(remainingFreeUnlocks(23)).toBe(0);
  });
  it("allows an active Premium account to bypass the catalog cap", () => {
    expect(canUnlockNewChallenge(15, true)).toBe(true);
    expect(canUnlockNewChallenge(15, false)).toBe(false);
  });
  it("expires demo entitlements on the exact expiry instant", () => {
    expect(planIsActive("2026-11-01T00:00:01Z", Date.parse("2026-11-01T00:00:00Z"))).toBe(true);
    expect(planIsActive("2026-11-01T00:00:00Z", Date.parse("2026-11-01T00:00:00Z"))).toBe(false);
    expect(planIsActive(null)).toBe(false);
  });
});
