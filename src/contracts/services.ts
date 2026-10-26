import type { Evaluation, Rubric, Submission, Task } from "./domain";
/** FROZEN INTERFACE v1 - Person 3 implements this, Person 2 consumes it. */
export interface AssessmentAiService {
  generateUnderstanding(input: {
    task: Task;
    theoryAnswer: string;
    practicalAnswer: string;
  }): Promise<{ question: string }>;
  evaluate(input: {
    task: Task;
    understandingQuestion: string;
    submission: Submission;
  }): Promise<Evaluation>;
}
/** FROZEN INTERFACE v1 - Person 4 implements this, Person 2 integrates it. */
export interface IntegritySnapshot {
  flaggedEventCount: number;
  disqualifyingTechnicalFailure: boolean;
  reviewRecommended: boolean;
}
export interface AssessmentPolicy {
  checkSnapshot(input: { attemptId: string; taskRubric: Rubric }): Promise<IntegritySnapshot>;
}
