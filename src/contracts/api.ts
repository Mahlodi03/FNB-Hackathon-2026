import { z } from "zod";
import { IntegrityEventSchema, SubmissionSchema } from "./domain";

export const StartAttemptRequestSchema = z.object({ taskId: z.string().uuid(), rulesAccepted: z.literal(true) });
export const StartAttemptResponseSchema = z.object({
  attemptId: z.string().uuid(),
  status: z.literal("in_progress"),
  expiresAt: z.string().datetime()
});
export const GenerateUnderstandingRequestSchema = z.object({ theoryAnswer: z.string().min(1), practicalAnswer: z.string().min(1) });
export const GenerateUnderstandingResponseSchema = z.object({ question: z.string().min(12), attemptStatus: z.literal("awaiting_understanding") });
export const SubmitAttemptRequestSchema = SubmissionSchema;
export const SubmitAttemptResponseSchema = z.object({ attemptId: z.string().uuid(), status: z.enum(["submitted", "graded"]), resultId: z.string().uuid().optional() });
export const SaveIntegrityEventRequestSchema = IntegrityEventSchema;
export const SaveIntegrityEventResponseSchema = z.object({ accepted: z.literal(true), eventCount: z.number().int().nonnegative(), reviewRecommended: z.boolean() });
export const ApiErrorSchema = z.object({ error: z.string(), code: z.string() });
