import { redirect } from "next/navigation";
import { LoginForm } from "@/features/identity/components/AuthForms";
import { SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { getSessionProfile } from "@/features/identity/queries";
import { safeRedirectPath } from "@/features/identity/schemas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in | Ready For Work" };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  const configured = isSupabaseConfigured();
  if (configured && (await getSessionProfile())) redirect(next);
  return (
    <section style={{ paddingTop: 60, maxWidth: 540, marginInline: "auto" }}>
      <div className="eyebrow">Welcome back</div>
      <h1 className="h2">Log in</h1>
      <div style={{ marginTop: 19 }}>
        {configured ? (
          <div className="card"><LoginForm next={next} callbackError={params.error === "callback"} /></div>
        ) : (
          <SetupNotice title="Log in is not available yet" />
        )}
      </div>
    </section>
  );
}
