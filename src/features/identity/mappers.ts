import { PublicStudentSchema, RoleSchema, type PublicStudent, type Role } from "../../contracts/domain";

export const PUBLIC_STUDENT_COLUMNS = "id,username,full_name,institution,field_of_interest,bio,avatar_url";
export const OWN_PROFILE_COLUMNS = `${PUBLIC_STUDENT_COLUMNS},role,is_public`;

export type PublicStudentRow = {
  id: string;
  username: string;
  full_name: string;
  institution: string | null;
  field_of_interest: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export type OwnProfileRow = PublicStudentRow & { role: string; is_public: boolean };

export type OwnProfile = PublicStudent & { role: Role; isPublic: boolean };

export type ResultCard = {
  attemptId: string;
  taskId: string;
  taskTitle: string;
  concept: string;
  skills: string[];
  overallScore: number;
  gradedAt: string;
};

export type ResultCardRow = {
  attempt_id: string;
  task_id: string;
  task_title: string;
  concept: string;
  skills: string[] | null;
  overall_score: number | string;
  graded_at: string;
};

export type OwnResultCard = ResultCard & { shareSubmission: boolean };

export type SubmissionDetail = {
  taskTitle: string;
  theoryAnswer: string | null;
  practicalAnswer: string | null;
  understandingQuestion: string | null;
  understandingAnswer: string | null;
  feedback: string;
  overallScore: number;
  gradedAt: string;
};

export type SubmissionDetailRow = {
  task_title: string;
  theory_answer: string | null;
  practical_answer: string | null;
  understanding_question: string | null;
  understanding_answer: string | null;
  feedback: string;
  overall_score: number | string;
  graded_at: string;
};

function safeAvatar(url: string | null): string | null {
  return url && /^https:\/\/[^\s"'()<>]+$/.test(url) ? url : null;
}

export function toPublicStudent(row: PublicStudentRow): PublicStudent | null {
  const parsed = PublicStudentSchema.safeParse({
    id: row.id,
    username: row.username,
    fullName: row.full_name?.trim() || row.username,
    institution: row.institution,
    fieldOfInterest: row.field_of_interest,
    bio: row.bio,
    avatarUrl: safeAvatar(row.avatar_url),
  });
  return parsed.success ? parsed.data : null;
}

export function toOwnProfile(row: OwnProfileRow): OwnProfile | null {
  const role = RoleSchema.safeParse(row.role);
  if (!role.success) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name ?? "",
    institution: row.institution,
    fieldOfInterest: row.field_of_interest,
    bio: row.bio,
    avatarUrl: safeAvatar(row.avatar_url),
    role: role.data,
    isPublic: row.is_public,
  };
}

export function toResultCard(row: ResultCardRow): ResultCard {
  return {
    attemptId: row.attempt_id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    concept: row.concept,
    skills: row.skills ?? [],
    overallScore: Math.round(Number(row.overall_score)),
    gradedAt: row.graded_at,
  };
}

export function toSubmissionDetail(row: SubmissionDetailRow): SubmissionDetail {
  return {
    taskTitle: row.task_title,
    theoryAnswer: row.theory_answer,
    practicalAnswer: row.practical_answer,
    understandingQuestion: row.understanding_question,
    understandingAnswer: row.understanding_answer,
    feedback: row.feedback,
    overallScore: Math.round(Number(row.overall_score)),
    gradedAt: row.graded_at,
  };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}
