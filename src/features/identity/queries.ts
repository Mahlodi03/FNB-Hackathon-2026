import "server-only";
import { cache } from "react";
import type { PublicStudent } from "@/contracts/domain";
import { serverSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import {
  OWN_PROFILE_COLUMNS,
  PUBLIC_STUDENT_COLUMNS,
  toOwnProfile,
  toPublicStudent,
  toResultCard,
  toSubmissionDetail,
  type OwnProfile,
  type OwnProfileRow,
  type OwnResultCard,
  type PublicStudentRow,
  type ResultCard,
  type ResultCardRow,
  type SubmissionDetail,
  type SubmissionDetailRow,
} from "./mappers";
import { SEARCH_PAGE_SIZE, UsernameParamSchema, UuidSchema } from "./schemas";
import { buildDirectoryFilter, pageRange } from "./search";

export class IdentityDataError extends Error {}

export type DirectoryPage = {
  students: PublicStudent[];
  page: number;
  pageSize: number;
  total: number;
};

export const getSessionProfile = cache(async (): Promise<OwnProfile | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(OWN_PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<OwnProfileRow>();
  if (error) throw new IdentityDataError("Could not load your profile");
  return data ? toOwnProfile(data) : null;
});

export async function searchPublicStudents(q: string, page: number): Promise<DirectoryPage> {
  const supabase = await serverSupabase();
  const { from, to } = pageRange(page, SEARCH_PAGE_SIZE);
  let query = supabase
    .from("profiles")
    .select(PUBLIC_STUDENT_COLUMNS, { count: "exact" })
    .eq("role", "student")
    .eq("is_public", true);
  const filter = buildDirectoryFilter(q);
  if (filter) query = query.or(filter);
  const { data, error, count } = await query
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to)
    .returns<PublicStudentRow[]>();
  if (error && error.code === "PGRST103") {
    return { students: [], page, pageSize: SEARCH_PAGE_SIZE, total: count ?? 0 };
  }
  if (error) throw new IdentityDataError("Could not search student profiles");
  const students = (data ?? []).map(toPublicStudent).filter((s): s is PublicStudent => s !== null);
  return { students, page, pageSize: SEARCH_PAGE_SIZE, total: count ?? students.length };
}

export async function getPublicStudentByUsername(username: string): Promise<PublicStudent | null> {
  const parsed = UsernameParamSchema.safeParse(username);
  if (!parsed.success) return null;
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_STUDENT_COLUMNS)
    .eq("username", parsed.data.toLowerCase())
    .eq("role", "student")
    .eq("is_public", true)
    .maybeSingle<PublicStudentRow>();
  if (error) throw new IdentityDataError("Could not load this profile");
  return data ? toPublicStudent(data) : null;
}

export async function getPublicResultCards(studentId: string): Promise<ResultCard[]> {
  if (!UuidSchema.safeParse(studentId).success) return [];
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("public_student_result_cards", { p_student_id: studentId });
  if (error) throw new IdentityDataError("Could not load assessment results");
  return ((data ?? []) as ResultCardRow[]).map(toResultCard);
}

export async function getPublicSubmissionDetail(attemptId: string): Promise<SubmissionDetail | null> {
  if (!UuidSchema.safeParse(attemptId).success) return null;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("public_student_submission_detail", { p_attempt_id: attemptId });
  if (error) throw new IdentityDataError("Could not load this submission");
  const row = ((data ?? []) as SubmissionDetailRow[])[0];
  return row ? toSubmissionDetail(row) : null;
}

type OwnResultRow = {
  overall_score: number | string;
  graded_at: string;
  attempts: {
    id: string;
    task_id: string;
    share_submission: boolean;
    tasks: { title: string; concept: string; skills: string[] | null } | null;
  } | null;
};

export async function getOwnPublishedResults(userId: string): Promise<OwnResultCard[]> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("results")
    .select("overall_score,graded_at,attempts!inner(id,task_id,share_submission,student_id,tasks(title,concept,skills))")
    .eq("attempts.student_id", userId)
    .eq("passed", true)
    .eq("visibility", "published")
    .eq("grading_source", "ai_assisted")
    .order("graded_at", { ascending: false })
    .returns<OwnResultRow[]>();
  if (error) throw new IdentityDataError("Could not load your results");
  return (data ?? []).flatMap((row) => {
    const attempt = row.attempts;
    if (!attempt?.tasks) return [];
    return [{
      ...toResultCard({
        attempt_id: attempt.id,
        task_id: attempt.task_id,
        task_title: attempt.tasks.title,
        concept: attempt.tasks.concept,
        skills: attempt.tasks.skills,
        overall_score: row.overall_score,
        graded_at: row.graded_at,
      }),
      shareSubmission: attempt.share_submission,
    }];
  });
}
