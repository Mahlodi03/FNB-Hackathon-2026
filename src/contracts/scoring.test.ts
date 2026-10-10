import { describe, expect, it } from "vitest";
import { calculateOverallScore, calculatePass } from "./scoring";
import { RubricSchema } from "./domain";
const rubric = RubricSchema.parse({
 theoryWeight: 30, practicalWeight: 50, understandingWeight: 20,
 theoryCriteria: ["Explains the concept"],
 practicalCriteria: ["Solves the problem"],
 understandingCriteria: ["Explains the own solution"]
});
describe("grading contract", () => {
 it("calculates server-side weighted score", () => {
  expect(calculateOverallScore({ theory: 80, practical: 90, understanding: 70 }, rubric)).toBe(83);
 });
 it("makes boundary pass decisions", () => {
  expect(calculatePass({ theory: 70, practical: 70, understanding: 70 }, rubric, 70)).toBe(true);
  expect(calculatePass({ theory: 69, practical: 69, understanding: 69 }, rubric, 70)).toBe(false);
 });
 it("rejects invalid weight totals", () => {
  expect(() => RubricSchema.parse({
   theoryWeight: 30, practicalWeight: 30, understandingWeight: 20,
   theoryCriteria: ["valid"], practicalCriteria: ["valid"], understandingCriteria: ["valid"]
  })).toThrow();
 });
});
