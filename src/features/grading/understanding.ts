import { z } from "zod";
import { TaskSchema } from "../../contracts/domain";
import type { AssessmentAiService } from "../../contracts/services";

type GenerateInput = Parameters<AssessmentAiService["generateUnderstanding"]>[0];

/** Shape requested from the model. More restrictive rules are checked after parsing. */
export const UnderstandingQuestionSchema = z.object({
  question: z.string(),
}).strict();

/** Prepare user-supplied text as data, not as AI instructions. */
export function prepareUnderstandingInput(input: GenerateInput): string {
  const task = TaskSchema.parse(input.task);
  const { theoryAnswer, practicalAnswer } = input;

  if (!theoryAnswer.trim() || !practicalAnswer.trim()) {
    throw new Error("AI_EMPTY_SUBMISSION");
  }
  if (theoryAnswer.length > 15_000 || practicalAnswer.length > 40_000) {
    throw new Error("AI_SUBMISSION_TOO_LONG");
  }

  return JSON.stringify({
    task: {
      title: task.title,
      concept: task.concept,
      difficulty: task.difficulty,
      theoryPrompt: task.theoryPrompt,
      practicalPrompt: task.practicalPrompt,
      understandingGuidance: task.understandingGuidance,
    },
    studentSubmission: { theoryAnswer, practicalAnswer },
  });
}

/** A syntactically valid JSON response can still contain an unusable question. */
export function parseUnderstandingQuestion(raw: unknown): { question: string } {
  const { question } = UnderstandingQuestionSchema.parse(raw);
  const normalized = question.trim();
  if (normalized.length < 12 || normalized.length > 500 || !normalized.endsWith("?")) {
    throw new Error("AI_INVALID_UNDERSTANDING_QUESTION");
  }
  return { question: normalized };
}
