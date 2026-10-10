import { DEMO_MODE } from "@/lib/flags";
import { demoStudents } from "@/content/demo";
import { notImplemented } from "@/lib/http";
export async function GET(){return DEMO_MODE?Response.json({students:demoStudents,source:"fictional_demo"}):notImplemented("RLS-filtered student directory");}
