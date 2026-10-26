
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import {
  IntegrityEventTypeSchema,
  type IntegrityEventType,
} from "@/contracts/domain";

import { AccessError, requireActor } from "@/server/auth/actor";
import { serviceSupabase } from "@/lib/supabase/admin";
import {
  AttemptIdSchema,
  TECHNICAL_INTERRUPTION_TYPES,
} from "@/server/integrity/rules";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    type?: string;
    attempt?: string;
  }>;
};

type Incident = {
  attempt_id: string;
  event_type: IntegrityEventType;
  recorded_at: string;
};

type AttemptSummary = {
  id: string;
  status: string;
};

type ReviewState = { attempt_id: string; decision: "cleared" | "needs_investigation" | "withheld" };

export default async function AdminIntegrity({
  searchParams,
}: PageProps) {
  // Wait for a real request instead of prerendering.
  await connection();

  // Only authenticated administrators can access incidents.
  try {
    await requireActor(["admin"]);
  } catch (error) {
    if (error instanceof AccessError && error.status === 401) {
      redirect("/login");
    }

    if (error instanceof AccessError && error.status === 403) {
      notFound();
    }

    throw error;
  }

  // Validate filter parameters.
  const params = await searchParams;

  const eventType = IntegrityEventTypeSchema.safeParse(params.type)
    .success
    ? (params.type as IntegrityEventType)
    : undefined;

  const attemptId = AttemptIdSchema.safeParse(params.attempt)
    .success
    ? params.attempt
    : undefined;

  // Access database only after successful authorization.
  const db = serviceSupabase();

  let query = db
    .from("integrity_events")
    .select("attempt_id,event_type,recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(100);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  if (attemptId) {
    query = query.eq("attempt_id", attemptId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      "Private integrity incidents are temporarily unavailable"
    );
  }

  const incidents = (data ?? []) as Incident[];

  // Group incidents by assessment attempt.
  const ids = [
    ...new Set(incidents.map((incident) => incident.attempt_id)),
  ];

  const summaryMap = new Map<string, AttemptSummary>();

  if (ids.length > 0) {
    const { data: attempts, error: attemptError } = await db
      .from("attempts")
      .select("id,status")
      .in("id", ids);

    if (attemptError) {
      throw new Error("Attempt statuses are temporarily unavailable");
    }

    for (const attempt of (attempts ?? []) as AttemptSummary[]) {
      summaryMap.set(attempt.id, attempt);
    }
  }

  const reviewMap = new Map<string, ReviewState>();
  if (ids.length > 0) {
    const { data: decisions, error: reviewError } = await db
      .from("integrity_review_state")
      .select("attempt_id,decision")
      .in("attempt_id", ids);
    if (reviewError) throw new Error("Private review decisions are temporarily unavailable");
    for (const review of (decisions ?? []) as ReviewState[]) reviewMap.set(review.attempt_id, review);
  }

  const groups = Map.groupBy(
    incidents,
    (event) => event.attempt_id
  );

  return (
    <section
      style={{
        paddingTop: 42,
        maxWidth: 950,
        marginInline: "auto",
      }}
    >
      <p className="eyebrow">
        Authorized administrators only
      </p>

      <h1 className="h2" style={{ marginTop: 8 }}>
        Private integrity review
      </h1>

      <p
        className="muted"
        style={{ margin: "14px 0 22px" }}
      >
        Signals are not proof of misconduct. Technical camera
        interruptions and potential rule concerns require fair,
        private human review. Never publish warnings or
        automatically alter scores.
      </p>

      {/* Incident filters */}
      <form
        method="get"
        className="card"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "end",
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <label
          style={{
            minWidth: 215,
            flex: "1 1 215px",
          }}
        >
          Event type

          <select
            name="type"
            defaultValue={eventType ?? ""}
          >
            <option value="">All event types</option>

            {IntegrityEventTypeSchema.options.map((type) => (
              <option value={type} key={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            minWidth: 250,
            flex: "2 1 250px",
          }}
        >
          Attempt ID

          <input
            className="input"
            name="attempt"
            defaultValue={attemptId ?? ""}
            placeholder="Optional exact UUID"
          />
        </label>

        <button type="submit" className="button">
          Filter incidents
        </button>

        <Link
          href="/admin/integrity"
          className="button secondary"
        >
          Clear
        </Link>
      </form>

      <p
        className="muted"
        style={{
          fontSize: 12,
          marginBottom: 16,
        }}
      >
        Showing up to 100 most recent matching events.
        Decisions are recorded by administrators and preserved in a private audit history.
      </p>

      {/* No incidents */}
      {groups.size === 0 && (
        <div className="card">
          <p>No recorded incidents match these filters.</p>
        </div>
      )}

      {/* Flagged attempt records */}
      <div style={{ display: "grid", gap: 15 }}>
        {[...groups.entries()].map(([id, events]) => (
          <article className="card" key={id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div>
                <p className="eyebrow">Attempt</p>

                <h2
                  style={{
                    fontSize: 15,
                    overflowWrap: "anywhere",
                    marginTop: 7,
                  }}
                >
                  {id}
                </h2>
              </div>

              <span className="pill">
                {summaryMap.get(id)?.status ??
                  "status unavailable"}
              </span>
            </div>

            <p
              className="muted"
              style={{
                margin: "10px 0 12px",
                fontSize: 13,
              }}
            >
              {events.length} recorded signal(s) in this view
              {" · "}
              {reviewMap.get(id)?.decision?.replaceAll("_", " ") ?? "Pending human assessment"}
            </p>

            <Link href={`/admin/integrity/${id}`} className="button secondary" style={{ display: "inline-flex", marginBottom: 12 }}>
              Review attempt and history →
            </Link>

            <ul
              style={{
                paddingLeft: 20,
                display: "grid",
                gap: 9,
              }}
            >
              {events.map((event, index) => (
                <li
                  key={`${event.recorded_at}-${event.event_type}-${index}`}
                  style={{ fontSize: 14 }}
                >
                  <strong>
                    {event.event_type.replaceAll("_", " ")}
                  </strong>

                  {TECHNICAL_INTERRUPTION_TYPES.includes(
                    event.event_type
                  ) && (
                    <span
                      className="pill"
                      style={{ marginLeft: 10 }}
                    >
                      Technical interruption reported
                    </span>
                  )}

                  <span
                    className="muted"
                    style={{
                      display: "block",
                      fontSize: 12,
                      marginTop: 3,
                    }}
                  >
                    Server received:{" "}
                    {new Date(
                      event.recorded_at
                    ).toLocaleString("en-ZA", {
                      timeZone: "Africa/Johannesburg",
                      timeZoneName: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
