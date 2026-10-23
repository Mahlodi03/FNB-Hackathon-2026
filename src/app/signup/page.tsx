import { redirect } from "next/navigation";
import { SignupForm } from "@/features/identity/components/AuthForms";
import { SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { getSessionProfile } from "@/features/identity/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an account | Ready For Work" };

export default async function Signup() {
  const configured = isSupabaseConfigured();
  if (configured && (await getSessionProfile())) redirect("/profile");
  return (
    <section style={{ paddingTop: 60, maxWidth: 540, marginInline: "auto" }}>
      <div className="eyebrow">Get started</div>
      <h1 className="h2">Create an account</h1>
      <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        Students build a profile of verified task results. Employers search public student profiles.
      </p>
      <div style={{ marginTop: 19 }}>
        {configured ? <div className="card"><SignupForm /></div> : <SetupNotice title="Sign-up is not available yet" />}
      </div>
    </section>
  );
}
