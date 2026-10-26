import "server-only";
import {serviceSupabase} from "@/lib/supabase/admin";
import {MONTHLY_MATCH_LIMIT,type Brief,type EvidenceRow} from "./rules";

export type SavedStudent = {brief_id:string;student_id:string;username:string;full_name:string};
export type TalentWorkspaceData = {
  briefs:Brief[]; used:number; limit:number; shortlists:SavedStudent[];
};
function utcMonthStart() {
  const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString();
}
/** Must only be called after authenticating and verifying employer + active Premium. */
export async function loadTalentWorkspace(employerId:string):Promise<TalentWorkspaceData> {
  const db=serviceSupabase();
  const [briefs,runs,shortlists]=await Promise.all([
    db.from("talent_job_briefs").select("id,title,description,required_skills,status,created_at")
      .eq("employer_id",employerId).order("created_at",{ascending:false}).limit(60),
    db.from("talent_match_runs").select("id",{count:"exact",head:true})
      .eq("employer_id",employerId).gte("created_at",utcMonthStart()),
    db.rpc("talent_visible_shortlists",{p_employer_id:employerId}),
  ]);
  if (briefs.error || runs.error || shortlists.error || runs.count === null)
    throw new Error("Talent matching workspace unavailable");
  return {briefs:(briefs.data??[]) as Brief[],used:runs.count,limit:MONTHLY_MATCH_LIMIT,
    shortlists:(shortlists.data??[]) as SavedStudent[]};
}
export async function getOwnedActiveBrief(employerId:string,briefId:string):Promise<Brief|null> {
  const {data,error}=await serviceSupabase().from("talent_job_briefs")
    .select("id,title,description,required_skills,status,created_at")
    .eq("id",briefId).eq("employer_id",employerId).eq("status","active").maybeSingle();
  if(error) throw new Error("Could not load employer brief");
  return data as Brief|null;
}
export async function loadConsentFilteredEvidence():Promise<EvidenceRow[]> {
  const {data,error}=await serviceSupabase().rpc("talent_public_evidence");
  if(error) throw new Error("Public candidate evidence temporarily unavailable");
  return (data??[]) as EvidenceRow[];
}
export async function reserveMatchingRun(employerId:string,briefId:string):Promise<{
  status:"reserved"|"not_eligible"|"not_found"|"monthly_limit";runId?:string;
}> {
  const {data,error}=await serviceSupabase().rpc("talent_reserve_run",{
    p_employer_id:employerId,p_brief_id:briefId,
  });
  if(error) throw new Error("Matching allowance unavailable");
  return data as {status:"reserved"|"not_eligible"|"not_found"|"monthly_limit";runId?:string};
}
export async function finishMatchingRun(employerId:string,runId:string,success:boolean) {
  const {error}=await serviceSupabase().rpc("talent_finish_run",{
    p_employer_id:employerId,p_run_id:runId,p_success:success,
  });
  if(error) console.error("Matching run finalization failed",error);
}
