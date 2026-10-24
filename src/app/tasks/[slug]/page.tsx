import { notFound, redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

// Legacy challenge detail URLs redirect to preflight; never render the questions.
export default async function ChallengeRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) notFound();
  redirect(`/assessment/${encodeURIComponent(data.id)}`);
}
