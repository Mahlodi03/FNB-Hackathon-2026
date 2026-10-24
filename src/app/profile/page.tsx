import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm, ShareToggle, SignOutButton } from "@/features/identity/components/ProfileForm";
import { Avatar, ErrorNotice, ResultCardView, SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { getOwnPublishedResults, getSessionProfile } from "@/features/identity/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "My profile | Ready For Work" };

export default async function Profile() {
  if (!isSupabaseConfigured()) {
    return (
      <section style={{ paddingTop: 50, maxWidth: 760 }}>
        <h1 className="h2" style={{ marginBottom: 20 }}>My profile</h1>
        <SetupNotice />
      </section>
    );
  }
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?next=/profile");
  const isStudent = profile.role === "student";
  let results: Awaited<ReturnType<typeof getOwnPublishedResults>> = [];
  let resultsError = false;
  if (isStudent) {
    try {
      results = await getOwnPublishedResults(profile.id);
    } catch {
      resultsError = true;
    }
  }
  return (
    <section style={{ paddingTop: 42, maxWidth: 860, display: "grid", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Avatar name={profile.fullName || profile.username} url={profile.avatarUrl} size={64} />
          <div>
            <div className="eyebrow">{isStudent ? "Student account" : profile.role === "employer" ? "Employer account" : "Admin account"}</div>
            <h1 className="h2" style={{ marginTop: 6 }}>{profile.fullName || profile.username}</h1>
            {isStudent ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {profile.isPublic ? (
                  <>Public · <Link style={{ color: "#663bd0" }} href={`/students/${profile.username}`}>View public profile</Link></>
                ) : "Private · only you can see this profile"}
              </p>
            ) : null}
          </div>
        </div>
        <SignOutButton />
      </div>

      {profile.role === "employer" ? (
        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <p className="muted" style={{ maxWidth: 460, lineHeight: 1.6 }}>
            Your employer profile is private. Search public student profiles to see verified task results.
          </p>
          <Link className="button" href="/students">Find students</Link>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>Edit profile</h2>
        <ProfileForm profile={profile} />
      </div>

      {isStudent ? (
        <div style={{ display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Completed tasks</h2>
          {resultsError ? <ErrorNotice message="We couldn't load your results right now. Please refresh the page." /> : null}
          {!resultsError && results.length === 0 ? (
            <div className="card">
              <p className="muted" style={{ lineHeight: 1.6 }}>
                You haven&apos;t passed any tasks yet. Passed tasks appear here once they are graded and published.
              </p>
              <Link className="button secondary" href="/tasks" style={{ marginTop: 14 }}>Browse tasks</Link>
            </div>
          ) : null}
          <div className="grid-cards">
            {results.map((card) => (
              <ResultCardView
                key={card.attemptId}
                card={card}
                footer={<ShareToggle attemptId={card.attemptId} initialShared={card.shareSubmission} />}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
