import { describe, expect, it } from "vitest";
import { z } from "zod";

const UnderstandingRequestSchema = z.object({
  theoryAnswer: z.string().min(1),
  practicalAnswer: z.string().min(1),
});

describe("understanding request validation", () => {
  it("accepts a valid request", () => {
    const result = UnderstandingRequestSchema.safeParse({
      theoryAnswer: "Composition favours flexibility over rigid inheritance.",
      practicalAnswer: "function solve() { return true; }",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty theory answer", () => {
    const result = UnderstandingRequestSchema.safeParse({
      theoryAnswer: "",
      practicalAnswer: "function solve() {}",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty practical answer", () => {
    const result = UnderstandingRequestSchema.safeParse({
      theoryAnswer: "Some explanation",
      practicalAnswer: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields entirely", () => {
    const result = UnderstandingRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});