import { AccessError, requireActor } from "@/server/auth/actor";
import { getPlanSummary } from "@/server/subscriptions/queries";
import { CareerCoachRequestSchema, recommendPublishedChallenges } from "@/server/career-coach/rules";
import { loadCareerCoachContext } from "@/server/career-coach/data";
import { careerCoachIsConfigured, generateCareerGuidance } from "@/server/career-coach/ai";
import { getCareerCoachUsage, markCareerCoachRequest, reserveCareerCoachRequest } from "@/server/career-coach/usage";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const actor = await requireActor(["student"]);
    const plan = await getPlanSummary(actor.userId, "student");
    if (plan.plan !== "premium") return Response.json({error:"Student Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:NO_STORE});
    const usage = await getCareerCoachUsage(actor.userId);
    return Response.json(usage,{headers:NO_STORE});
  } catch(error) {
    if(error instanceof AccessError) return Response.json({error:error.message},{status:error.status,headers:NO_STORE});
    console.error("Career coach usage status failed",error);
    return Response.json({error:"Career Coach is temporarily unavailable"},{status:503,headers:NO_STORE});
  }
}

export async function POST(request:Request) {
  try {
    const actor = await requireActor(["student"]);
    const plan = await getPlanSummary(actor.userId,"student");
    if(plan.plan!=="premium") return Response.json({error:"Student Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:NO_STORE});
    const parsed = CareerCoachRequestSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success) return Response.json({error:"Choose one of the supported career goals"},{status:400,headers:NO_STORE});
    if(!careerCoachIsConfigured()) return Response.json({error:"Career Coach AI is not configured"},{status:503,headers:NO_STORE});

    // Fail closed on context lookup errors. No AI call or quota reservation in that case.
    const context = await loadCareerCoachContext(actor.userId);
    const challenges = recommendPublishedChallenges(parsed.data.goal,context.challenges,context.startedTaskIds,context.evidence);

    // The DB function rechecks role + active Premium inside a serialized transaction.
    // It enforces a UTC-day allowance and cooldown even for parallel requests.
    const reservation = await reserveCareerCoachRequest(actor.userId);
    if(reservation.status==="not_eligible") return Response.json({error:"Student Premium required",code:"PREMIUM_REQUIRED"},{status:403,headers:NO_STORE});
    if(reservation.status==="daily_limit") return Response.json({error:"Daily Career Coach limit reached. Try again after 00:00 UTC.",code:"DAILY_LIMIT"},{status:429,headers:NO_STORE});
    if(reservation.status==="cooldown") return Response.json({error:"Please wait one minute between requests.",code:"COOLDOWN"},{status:429,headers:NO_STORE});

    let success = false;
    try {
      const guidance = await generateCareerGuidance(parsed.data.goal,context.evidence,challenges);
      // A student without qualifying evidence has no verified strengths to report.
      if (context.evidence.length === 0) guidance.demonstratedStrengths = [];
      success = true;
      // A quota-read hiccup must not discard a paid AI answer that was generated.
      const usage = await getCareerCoachUsage(actor.userId).catch(() => null);
      return Response.json({goal:parsed.data.goal,guidance,recommendedChallenges:challenges,
        evidenceCount:context.evidence.length, usage}, {headers:NO_STORE});
    } finally {
      await markCareerCoachRequest(actor.userId,reservation.requestId,success);
    }
  } catch(error) {
    if(error instanceof AccessError) return Response.json({error:error.message},{status:error.status,headers:NO_STORE});
    console.error("Career Coach request failed",error);
    return Response.json({error:"Career Coach could not prepare guidance. Please try later."},{status:503,headers:NO_STORE});
  }
}
