import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { LoginForm } from "@/features/identity/components/AuthForms";
import { SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { getSessionProfile } from "@/features/identity/queries";
import { safeRedirectPath } from "@/features/identity/schemas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in | Ready For Work" };
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  const next=safeRedirectPath(params.next);
  const configured=isSupabaseConfigured();
  if(configured && await getSessionProfile())redirect(next);
  return <section>
    <div className="rw-auth-top"><Link href="/" className="rw-logo"><span className="rw-logo-emblem"><GraduationCap size={27}/></span><span className="rw-logo-words">READY<span>FOR</span>WORK.</span></Link></div>
    {configured?<div className="card rw-auth-card"><h1>Welcome back</h1><p className="muted">Sign in to your Ready For Work account</p><LoginForm next={next} callbackError={params.error==="callback"}/></div>:<SetupNotice title="Log in is not available yet"/>}
    <Link href="/" className="rw-auth-back">← Back to Ready For Work</Link>
  </section>;
}
