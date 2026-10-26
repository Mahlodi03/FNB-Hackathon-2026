import { describe, expect, it } from "vitest";
import { z } from "zod";

const StartAttemptSchema = z.object({
  taskId: z.string().uuid(),
  rulesAccepted: z.literal(true),
});

describe("start attempt request validation", () => {
  it("accepts a valid request", () => {
    const result = StartAttemptSchema.safeParse({
      taskId: "10000000-0000-4000-8000-000000000001",
      rulesAccepted: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing taskId", () => {
    const result = StartAttemptSchema.safeParse({
      rulesAccepted: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid taskId format", () => {
    const result = StartAttemptSchema.safeParse({
      taskId: "not-a-real-uuid",
      rulesAccepted: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects rulesAccepted being false", () => {
    const result = StartAttemptSchema.safeParse({
      taskId: "10000000-0000-4000-8000-000000000001",
      rulesAccepted: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects rulesAccepted being missing entirely", () => {
    const result = StartAttemptSchema.safeParse({
      taskId: "10000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
  });
});