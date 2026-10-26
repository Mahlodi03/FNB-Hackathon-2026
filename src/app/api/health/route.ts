import { DEMO_MODE } from "@/lib/flags";
export async function GET(){ return Response.json({ok:true,app:"ready-for-work",demoMode:DEMO_MODE,apiVersion:"v1"}); }
