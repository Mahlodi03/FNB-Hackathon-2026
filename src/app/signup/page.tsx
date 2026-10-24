import { redirect } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/features/shell/BrandLogo";
import { SignupForm } from "@/features/identity/components/AuthForms";
import { SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { getSessionProfile } from "@/features/identity/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign up | Ready For Work" };
export default async function Signup(){
  const configured=isSupabaseConfigured();
  if (configured) {
    const profile = await getSessionProfile();
    if (profile) redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }
  return <section>
    <div className="rw-auth-top"><BrandLogo /></div>
    {configured?<div className="card rw-auth-card"><h1>Create your account</h1><p className="muted">Join and start building your skills evidence</p><SignupForm/></div>:<SetupNotice title="Sign-up is not available yet"/>}
    <Link href="/" className="rw-auth-back">← Back to Ready For Work</Link>
  </section>;
}
