import { z } from "zod";

export const RoleSchema = z.enum(["student", "employer", "admin"]);
export type Role = z.infer<typeof RoleSchema>;
export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const RubricSchema = z.object({
  theoryWeight: z.number().int().min(0).max(100),
  practicalWeight: z.number().int().min(0).max(100),
  understandingWeight: z.number().int().min(0).max(100),
  theoryCriteria: z.array(z.string().min(3)).min(1),
  practicalCriteria: z.array(z.string().min(3)).min(1),
  understandingCriteria: z.array(z.string().min(3)).min(1),
}).refine((r) => r.theoryWeight + r.practicalWeight + r.understandingWeight === 100, {
  message: "Rubric weights must sum to 100"
});
export type Rubric = z.infer<typeof RubricSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(3),
  title: z.string().min(3),
  concept: z.string().min(2),
  difficulty: DifficultySchema,
  durationSeconds: z.number().int().min(300).max(14400),
  theoryPrompt: z.string().min(12),
  practicalPrompt: z.string().min(12),
  understandingGuidance: z.string().min(12),
  rubric: RubricSchema,
  passMark: z.number().int().min(1).max(100),
  skills: z.array(z.string().min(1)).min(1),
  status: z.enum(["draft", "published"])
});
export type Task = z.infer<typeof TaskSchema>;
/** Admin POST body: database generates id; draft is the safe default. */
export const TaskCreateSchema = TaskSchema.omit({ id: true }).extend({
  status: z.enum(["draft", "published"]).default("draft"),
});
export type TaskCreate = z.infer<typeof TaskCreateSchema>;

export const PublicStudentSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3),
  fullName: z.string().min(1),
  institution: z.string().nullable(),
  fieldOfInterest: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});
export type PublicStudent = z.infer<typeof PublicStudentSchema>;

export const AttemptStatusSchema = z.enum([
  "in_progress", "awaiting_understanding", "submitted", "graded", "invalidated"
]);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;
export const IntegrityEventTypeSchema = z.enum([
  "tab_hidden", "window_blur", "fullscreen_exit", "paste_attempt", "copy_attempt",
  "camera_track_ended", "face_missing", "multiple_faces", "display_change", "permission_lost"
]);
export type IntegrityEventType = z.infer<typeof IntegrityEventTypeSchema>;
export const IntegrityEventSchema = z.object({
  eventType: IntegrityEventTypeSchema,
  occurredAt: z.string().datetime(),
});
export type IntegrityEvent = z.infer<typeof IntegrityEventSchema>;

export const SubmissionSchema = z.object({
  theoryAnswer: z.string().min(1).max(15000),
  practicalAnswer: z.string().min(1).max(40000),
  understandingAnswer: z.string().min(1).max(15000),
});
export type Submission = z.infer<typeof SubmissionSchema>;

export const SectionScoresSchema = z.object({
  theory: z.number().min(0).max(100),
  practical: z.number().min(0).max(100),
  understanding: z.number().min(0).max(100)
});
export type SectionScores = z.infer<typeof SectionScoresSchema>;

export const EvaluationSchema = z.object({
  scores: SectionScoresSchema,
  feedback: z.string().min(10),
  strengths: z.array(z.string()),
  improvements: z.array(z.string())
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const PublishedResultSchema = z.object({
  attemptId: z.string().uuid(),
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  concept: z.string(),
  skills: z.array(z.string()),
  overallScore: z.number().min(0).max(100),
  passed: z.literal(true),
  visibility: z.literal("published"),
  grader: z.literal("ai_assisted"),
});
export type PublishedResult = z.infer<typeof PublishedResultSchema>;
