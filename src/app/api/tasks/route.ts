import { DEMO_MODE } from "@/lib/flags";
import { demoTasks } from "@/content/demo";
import { notImplemented } from "@/lib/http";
export async function GET(){return DEMO_MODE? Response.json({tasks:demoTasks,source:"fictional_demo"}):notImplemented("Live task listing");}
export async function POST(){return notImplemented("Protected admin task creation");}
