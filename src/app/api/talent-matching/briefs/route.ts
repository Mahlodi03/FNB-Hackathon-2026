import {AccessError,requireActor} from "@/server/auth/actor";
import {getPlanSummary} from "@/server/subscriptions/queries";
import {serviceSupabase} from "@/lib/supabase/admin";
import {BriefActionSchema} from "@/server/talent-matching/rules";
const HEADERS={"Cache-Control":"private, no-store"};

export async function POST(request:Request) {
  try {
    const actor=await requireActor(["employer"]);
    const plan=await getPlanSummary(actor.userId,"employer");
    if(plan.plan!=="premium") return Response.json({error:"Employer Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:HEADERS});
    const parsed=BriefActionSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success) return Response.json({error:"Check job brief fields"},{status:400,headers:HEADERS});
    const payload=parsed.data;
    const action=payload.action==="create"
      ? await serviceSupabase().rpc("talent_create_brief",{
        p_employer_id:actor.userId,p_title:payload.brief.title,
        p_description:payload.brief.description,p_skills:payload.brief.requiredSkills,
      })
      : await serviceSupabase().rpc("talent_archive_brief",{
        p_employer_id:actor.userId,p_brief_id:payload.briefId,
      });
    if(action.error) throw new Error("Database refused brief mutation");
    const result=action.data as {status:string};
    const status=result.status==="created"||result.status==="archived"?200:
      result.status==="not_eligible"?403:result.status==="brief_limit"?409:
      result.status==="not_found"?404:400;
    return Response.json(result,{status,headers:HEADERS});
  }catch(e){
    if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status,headers:HEADERS});
    console.error("Talent briefs error",e);
    return Response.json({error:"Unable to update job brief"},{status:503,headers:HEADERS});
  }
}
