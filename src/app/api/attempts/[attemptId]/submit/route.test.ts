import { describe, expect, it } from "vitest";
import { z } from "zod";

const SubmitRequestSchema = z.object({
  understandingAnswer: z.string().min(1),
});

describe("submit request validation", () => {
  it("accepts a valid request", () => {
    const result = SubmitRequestSchema.safeParse({
      understandingAnswer: "I chose composition because it avoids tight coupling.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty understanding answer", () => {
    const result = SubmitRequestSchema.safeParse({
      understandingAnswer: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing understanding answer", () => {
    const result = SubmitRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});