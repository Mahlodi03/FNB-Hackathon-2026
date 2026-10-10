import type { Rubric, SectionScores } from "./domain";
/** Server decides pass/fail; never accept an AI-provided overall score or pass flag. */
export function calculateOverallScore(scores: SectionScores, rubric: Rubric): number {
  const weighted = (scores.theory * rubric.theoryWeight +
    scores.practical * rubric.practicalWeight +
    scores.understanding * rubric.understandingWeight) / 100;
  return Math.round(weighted * 100) / 100;
}
export function calculatePass(scores: SectionScores, rubric: Rubric, passMark: number): boolean {
  return calculateOverallScore(scores, rubric) >= passMark;
}
