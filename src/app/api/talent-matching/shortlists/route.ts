import {AccessError,requireActor} from "@/server/auth/actor";
import {getPlanSummary} from "@/server/subscriptions/queries";
import {serviceSupabase} from "@/lib/supabase/admin";
import {ShortlistSchema} from "@/server/talent-matching/rules";
const HEADERS={"Cache-Control":"private, no-store"};
export async function POST(request:Request) {
  try {
    const actor=await requireActor(["employer"]);
    if((await getPlanSummary(actor.userId,"employer")).plan!=="premium")
      return Response.json({error:"Employer Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:HEADERS});
    const parsed=ShortlistSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success) return Response.json({error:"Invalid shortlist request"},{status:400,headers:HEADERS});
    const {data,error}=await serviceSupabase().rpc("talent_save_shortlist",{
      p_employer_id:actor.userId,p_brief_id:parsed.data.briefId,
      p_student_id:parsed.data.studentId,p_save:parsed.data.save,
    });
    if(error)throw new Error("Could not update shortlist");
    const result=data as {status:string};
    return Response.json(result,{status:result.status==="saved"||result.status==="removed"?200:
      result.status==="not_eligible"?403:result.status==="not_found"?404:400,headers:HEADERS});
  }catch(e){
    if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status,headers:HEADERS});
    console.error("Talent shortlist error",e);
    return Response.json({error:"Unable to update shortlist"},{status:503,headers:HEADERS});
  }
}
