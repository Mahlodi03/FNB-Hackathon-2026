import Link from "next/link";
import { Avatar, ErrorNotice, SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { searchPublicStudents, type DirectoryPage } from "@/features/identity/queries";
import { DirectoryQuerySchema } from "@/features/identity/schemas";

export const metadata = { title: "Student profiles | Ready For Work" };

function pageHref(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/students?${query}` : "/students";
}

export default async function StudentDirectory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
    <section style={{ paddingTop: 42, display: "grid", gap: 22 }}>
      <div>
        <div className="eyebrow">Talent discovery</div>
        <h1 className="h2" style={{ margin: "10px 0 8px" }}>Explore student profiles</h1>
        <p className="muted">Only students who chose to make their profile public are listed.</p>
      </div>
      <form role="search" action="/students" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 260px" }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search students</span>
          <input className="input" name="q" defaultValue={q} maxLength={80} placeholder="Search by name, institution or interest" />
        </label>
        <button className="button" type="submit">Search</button>
      </form>
      {!configured ? <SetupNotice /> : null}
      {failed ? <ErrorNotice message="We couldn't load student profiles right now. Please try again." /> : null}
      {result && result.students.length === 0 ? (
        <div className="card">
          <p className="muted">{q ? `No public student profiles match “${q}”.` : "No public student profiles yet."}</p>
        </div>
      ) : null}
      {result && result.students.length > 0 ? (
        <>
          <p className="muted" style={{ fontSize: 13 }}>{result.total} {result.total === 1 ? "student" : "students"} found</p>
          <div className="grid-cards">
            {result.students.map((s) => (
              <div key={s.id} className="card" style={{ display: "grid", gap: 12, alignContent: "start" }}>
                <Avatar name={s.fullName} url={s.avatarUrl} />
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800 }}>{s.fullName}</h2>
                  <p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    {[s.institution, s.fieldOfInterest].filter(Boolean).join(" · ") || "Student"}
                  </p>
                </div>
                <Link className="button secondary" href={`/students/${s.username}`}>View profile</Link>
              </div>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav aria-label="Pagination" style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
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
