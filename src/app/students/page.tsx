import Link from "next/link";
import { ArrowRight, Search, UsersRound } from "lucide-react";
import { Avatar, ErrorNotice, SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { searchPublicStudents, type DirectoryPage } from "@/features/identity/queries";
import { DirectoryQuerySchema } from "@/features/identity/schemas";
import { requireDirectoryAccess } from "@/features/identity/requireDirectoryAccess";
import { studentSummary } from "@/features/identity/summary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Students | Ready For Work" };

function pageHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/students?${query}` : "/students";
}

export default async function StudentDirectory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireDirectoryAccess("/students");
  const raw = await searchParams;
  const { q, page } = DirectoryQuerySchema.parse({
    q: typeof raw.q === "string" ? raw.q : "",
    page: typeof raw.page === "string" ? raw.page : 1,
  });
  const configured = isSupabaseConfigured();
  let result: DirectoryPage | null = null;
  let failed = false;
  if (configured) {
    try {
      result = await searchPublicStudents(q, page);
    } catch {
      failed = true;
    }
  }
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  return (
    <section style={{ display: "grid", gap: 24 }}>
      <div className="rw-page-heading">
        <div className="eyebrow">Student community</div>
        <h1 className="h2" style={{ margin: "10px 0 8px" }}>Discover emerging talent</h1>
        <p className="muted">Connect with students who chose to share their profiles. Only signed-in Ready For Work members can browse.</p>
      </div>
      <form role="search" action="/students" className="rw-directory-search">
        <label>
          <span className="sr-only">Search students</span>
          <input className="input" name="q" defaultValue={q} maxLength={80} placeholder="Name, institution or field of interest" />
        </label>
        <button className="button" type="submit"><Search size={16} /> Search</button>
      </form>
      {!configured ? <SetupNotice /> : null}
      {failed ? <ErrorNotice message="We couldn't load student profiles right now. Please try again." /> : null}
      {result && result.students.length === 0 ? (
        <div className="rw-empty" style={{ display: "grid", justifyItems: "center", gap: 10, padding: 50 }}>
          <UsersRound size={30} color="#7858d9" />
          <strong style={{ color: "#293859" }}>{q ? "No matching students" : "No public profiles just yet"}</strong>
          <span>{q ? `Try a different search term. No profiles match “${q}”.` : "Students appear here after choosing to make their profiles public."}</span>
          {q && <Link className="button secondary" href="/students">Clear search</Link>}
        </div>
      ) : null}
      {result && result.students.length > 0 ? (
        <>
          <div className="rw-section-head" style={{ marginBottom: 0 }}>
            <h2>Student profiles</h2>
            <span className="pill">{result.total} {result.total === 1 ? "student" : "students"} found</span>
          </div>
          <div className="rw-directory-grid">
            {result.students.map((s) => (
              <article key={s.id} className="card rw-student-card">
                <div className="rw-student-card-header">
                  <Avatar name={s.fullName} url={s.avatarUrl} size={55} />
                  <div className="rw-student-card-heading">
                    <h2>{s.fullName}</h2>
                    <p className="rw-student-card-subtitle">
                      {[s.fieldOfInterest, s.institution].filter(Boolean).join(" · ") || "Student profile"}
                    </p>
                  </div>
                </div>
                <p className="rw-student-card-bio">{studentSummary(s)}</p>
                <div className="rw-student-card-footer">
                  <span className="pill">Public profile</span>
                  <Link className="button secondary" href={`/students/${s.username}`}>View profile <ArrowRight size={15}/></Link>
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav aria-label="Student directory pages" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
              {page > 1 ? <Link className="button secondary" href={pageHref(q, page - 1)}>Previous</Link> : null}
              <span className="muted" style={{ fontSize: 13 }}>Page {page} of {totalPages}</span>
              {page < totalPages ? <Link className="button secondary" href={pageHref(q, page + 1)}>Next</Link> : null}
            </nav>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
