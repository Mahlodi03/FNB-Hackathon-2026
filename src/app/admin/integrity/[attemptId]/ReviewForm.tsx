"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { type ReviewDecision, reviewLabels } from "@/server/integrity/review/schema";

export function ReviewForm({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<ReviewDecision>("needs_investigation");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch("/api/admin/integrity/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, decision, reason }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Unable to save decision");
        return;
      }
      setSaved(`Decision saved. Evidence visibility: ${payload.visibility}.`);
      setReason("");
      router.refresh();
    } catch {
      setError("Network error. Check the review history before retrying.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={(event) => { void submit(event); }} style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 19 }}>Record a human review</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Signals are not proof of misconduct. Decisions change evidence visibility only, not assessment scores.
        Each submission adds a permanent audit entry.
      </p>
      <label htmlFor="integrity-decision">Decision</label>
      <select id="integrity-decision" value={decision} onChange={(event) => setDecision(event.target.value as ReviewDecision)}>
        {(Object.keys(reviewLabels) as ReviewDecision[]).map((value) => (
          <option key={value} value={value}>{reviewLabels[value]}</option>
        ))}
      </select>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        Clearing publishes only eligible passing AI-assisted results. Investigation and withholding keep evidence private.
      </p>
      <label htmlFor="integrity-reason">Reason (minimum 20 characters)</label>
      <textarea
        id="integrity-reason" required minLength={20} maxLength={2000} rows={4}
        value={reason} onChange={(event) => setReason(event.target.value)}
        placeholder="Summarize the available evidence, context, and rationale for this decision."
      />
      <button className="button" type="submit" disabled={saving || reason.trim().length < 20}>
        {saving ? "Saving review…" : "Save human decision"}
      </button>
      {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
      {saved && <p role="status" style={{ color: "#16734a" }}>{saved}</p>}
    </form>
  );
}
