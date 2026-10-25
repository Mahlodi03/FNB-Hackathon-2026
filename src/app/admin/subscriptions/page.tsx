import { redirect, notFound } from "next/navigation";
import { requireActor, AccessError } from "@/server/auth/actor";
import { DemoEntitlementForm } from "./DemoEntitlementForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo Premium grants | Ready For Work" };

export default async function DemoSubscriptions() {
  try { await requireActor(["admin"]); }
  catch (error) {
    if (error instanceof AccessError && error.status === 401) redirect("/login?next=/admin/subscriptions");
    if (error instanceof AccessError && error.status === 403) notFound();
    throw error;
  }
  return <section>
    <div className="rw-page-heading"><span className="eyebrow">Restricted administration</span><h1 className="h2">Premium demo access</h1><p className="muted">Simulated subscriptions for testing student and employer entitlements.</p></div>
    <DemoEntitlementForm />
  </section>;
}
