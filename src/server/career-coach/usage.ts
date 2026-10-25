import "server-only";
import { serviceSupabase } from "@/lib/supabase/admin";
import { z } from "zod";
import { CAREER_COACH_DAILY_LIMIT } from "./rules";

const ReserveResultSchema = z.discriminatedUnion("status", [
  z.object({status:z.literal("reserved"),requestId:z.string().uuid()}),
  z.object({status:z.literal("not_eligible")}),
  z.object({status:z.literal("daily_limit")}),
  z.object({status:z.literal("cooldown")}),
]);
export type ReserveResult = z.infer<typeof ReserveResultSchema>;

export async function reserveCareerCoachRequest(studentId: string): Promise<ReserveResult> {
  const {data,error} = await serviceSupabase().rpc("reserve_career_coach_request",{p_student_id:studentId});
  if (error) throw new Error("Could not check career coach usage allowance");
  return ReserveResultSchema.parse(data);
}

export async function markCareerCoachRequest(studentId: string, requestId: string, success: boolean) {
  const {error} = await serviceSupabase().rpc("finish_career_coach_request",{
    p_student_id:studentId,p_request_id:requestId,p_success:success,
  });
  if (error) console.error("Unable to finalize career coach usage reservation",error);
}

export async function getCareerCoachUsage(studentId: string): Promise<{used:number;limit:number}> {
  const db = serviceSupabase();
  const date = new Date();
  const utcMidnight = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())).toISOString();
  const {count,error} = await db.from("career_coach_usage")
    .select("id",{count:"exact",head:true}).eq("student_id",studentId).gte("created_at",utcMidnight);
  if (error || count === null) throw new Error("Career coach usage unavailable");
  return {used:count,limit:CAREER_COACH_DAILY_LIMIT};
}
