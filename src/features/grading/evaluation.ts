import { z } from "zod";
import { EvaluationSchema, SubmissionSchema, TaskSchema } from "../../contracts/domain";
import type { AssessmentAiService } from "../../contracts/services";
import { parseUnderstandingQuestion } from "./understanding";

type EvaluateInput = Parameters<AssessmentAiService["evaluate"]>[0];

/**
 * This schema is sent to the OpenAI Structured Outputs API. Keep JSON Schema
 * constraints simple; enforce numeric and length bounds locally afterward.
 */
export const ModelEvaluationSchema = z.object({
  scores: z.object({
    theory: z.number(),
    practical: z.number(),
    understanding: z.number(),
  }).strict(),
  feedback: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
}).strict();

/** Only the assessment questions, rubric and student answers are sent to the AI. */
export function prepareEvaluationInput(input: EvaluateInput): string {
  const task = TaskSchema.parse(input.task);
  const submission = SubmissionSchema.parse(input.submission);
  const understandingQuestion = parseUnderstandingQuestion({
    question: input.understandingQuestion,
  }).question;

  for (const answer of Object.values(submission)) {
    if (!answer.trim()) throw new Error("AI_EMPTY_SUBMISSION");
  }

  return JSON.stringify({
    task: {
      title: task.title,
      concept: task.concept,
      difficulty: task.difficulty,
      theoryPrompt: task.theoryPrompt,
      practicalPrompt: task.practicalPrompt,
      understandingQuestion,
      rubric: {
        theoryCriteria: task.rubric.theoryCriteria,
        practicalCriteria: task.rubric.practicalCriteria,
        understandingCriteria: task.rubric.understandingCriteria,
      },
    },
    studentSubmission: submission,
  });
}

/**
 * Reject invalid output instead of rounding, clamping or inventing a grade.
 * The caller calculates the weighted overall score and pass/fail.
 */
export function parseEvaluationResult(raw: unknown) {
  const model = ModelEvaluationSchema.parse(raw);
  const evaluation = EvaluationSchema.parse({
    scores: model.scores,
    feedback: model.feedback.trim(),
    strengths: model.strengths.map((s) => s.trim()),
    improvements: model.improvements.map((s) => s.trim()),
  });

  if (evaluation.feedback.length > 2000) {
    throw new Error("AI_INVALID_EVALUATION_FEEDBACK");
  }
  for (const items of [evaluation.strengths, evaluation.improvements]) {
    if (items.length > 5 || items.some((s) => s.length < 3 || s.length > 250)) {
      throw new Error("AI_INVALID_EVALUATION_ITEMS");
    }
  }
  return evaluation;
}
