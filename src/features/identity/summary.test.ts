import { describe, expect, it } from "vitest";
import { studentSummary } from "./summary";

describe("student directory summaries", () => {
  it("uses the student's own bio without inventing experience", () => {
    expect(studentSummary({ bio: "Learning TypeScript and databases.", fieldOfInterest: "Web development", institution: null }))
      .toBe("Learning TypeScript and databases.");
  });
  it("falls back to a stated field of interest", () => {
    expect(studentSummary({ bio: "  ", fieldOfInterest: "Data Science", institution: "University" }))
      .toBe("Interested in Data Science.");
  });
  it("shows a neutral placeholder without personal details", () => {
    expect(studentSummary({ bio: null, fieldOfInterest: null, institution: null }))
      .toContain("hasn't added");
  });
  it("shortens a long bio safely", () => {
    const summary = studentSummary({ bio: "I am learning databases and TypeScript. ".repeat(20), fieldOfInterest: null, institution: null });
    expect(summary.endsWith("…")).toBe(true);
    expect(summary.length).toBeLessThan(185);
  });
});
