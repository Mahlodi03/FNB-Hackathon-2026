import {AccessError,requireActor} from "@/server/auth/actor";
import {getPlanSummary} from "@/server/subscriptions/queries";
import {RunSchema,rankEvidenceCandidates} from "@/server/talent-matching/rules";
import {analyzeTalentBrief,talentAIConfigured} from "@/server/talent-matching/ai";
import {finishMatchingRun,getOwnedActiveBrief,loadConsentFilteredEvidence,reserveMatchingRun} from "@/server/talent-matching/data";
const HEADERS={"Cache-Control":"private, no-store"};
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    const actor=await requireActor(["employer"]);
    if((await getPlanSummary(actor.userId,"employer")).plan!=="premium")
      return Response.json({error:"Employer Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:HEADERS});
    const parsed=RunSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success)return Response.json({error:"Choose an existing job brief"},{status:400,headers:HEADERS});
    if(!talentAIConfigured())return Response.json({error:"Talent Matching AI is not configured"},{status:503,headers:HEADERS});
    const brief=await getOwnedActiveBrief(actor.userId,parsed.data.briefId);
    if(!brief)return Response.json({error:"Active brief unavailable"},{status:404,headers:HEADERS});
    // Load DB-gated published evidence before making any quota reservation or AI call.
    await loadConsentFilteredEvidence();
    const reservation=await reserveMatchingRun(actor.userId,brief.id);
    if(reservation.status==="not_eligible")return Response.json({error:"Employer Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:HEADERS});
    if(reservation.status==="not_found")return Response.json({error:"Active brief unavailable"},{status:404,headers:HEADERS});
    if(reservation.status==="monthly_limit")return Response.json({error:"Monthly 20-run limit reached",code:"MONTHLY_LIMIT"},{status:429,headers:HEADERS});
    if(!reservation.runId)return Response.json({error:"Unable to reserve matching run"},{status:503,headers:HEADERS});
    let succeeded=false;
    try {
      // Only employer-provided brief content goes to OpenAI; no student record or ID.
      const analysis=await analyzeTalentBrief({title:brief.title,description:brief.description,required_skills:brief.required_skills});
      // The second snapshot is the only evidence used to rank or explain candidates.
      const stillVisible=await loadConsentFilteredEvidence();
      const candidates=rankEvidenceCandidates(stillVisible,analysis.focusSkills);
      // A Premium revocation during generation must not return a candidate list.
      if((await getPlanSummary(actor.userId,"employer")).plan!=="premium")
        return Response.json({error:"Employer Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:HEADERS});
      succeeded=true;
      return Response.json({briefId:brief.id,analysis,candidates,runId:reservation.runId,
        note:"Published-evidence skill coverage, not a hiring suitability or job performance score."},
        {headers:HEADERS});
    }finally {
      await finishMatchingRun(actor.userId,reservation.runId,succeeded);
    }
  }catch(e){
    if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status,headers:HEADERS});
    console.error("Employer talent matching failed",e);
    return Response.json({error:"Matching unavailable. Try later."},{status:503,headers:HEADERS});
  }
}
