"use client";

import { useState } from "react";

export function DemoEntitlementForm() {
  const [userId, setUserId] = useState("");
  const [days, setDays] = useState(30);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(action: "grant" | "revoke") {
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/subscriptions/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(action === "grant" ? { userId, days, action } : { userId, action }),
      });
      const result: { error?: string } = await response.json();
      setMessage(response.ok
        ? action === "grant" ? "Demo Premium granted. This is not a paid subscription." : "Demo Premium revoked."
        : result.error || "Unable to update the account.");
    } catch {
      setMessage("Network error. Check the current entitlement before trying again.");
    } finally {
      setWorking(false);
    }
  }

  return <div className="card" style={{ display: "grid", gap: 14, maxWidth: 700 }}>
    <h2 style={{ fontSize: 18, margin: 0 }}>Administrator demo entitlement</h2>
    <p className="muted">Grant or revoke temporary Premium access to an existing student or employer by their Supabase user UUID. No payments are processed. The database records each change.</p>
    <label htmlFor="entitlement-user">Student or employer UUID</label>
    <input id="entitlement-user" value={userId} onChange={event => setUserId(event.target.value.trim())} placeholder="Existing account UUID" />
    <label htmlFor="entitlement-days">Demo duration (1–90 days)</label>
    <input id="entitlement-days" type="number" min={1} max={90} value={days} onChange={event => setDays(Number(event.target.value))} />
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button type="button" className="button" disabled={working || !userId} onClick={() => void submit("grant")}>Grant demo Premium</button>
      <button type="button" className="button secondary" disabled={working || !userId} onClick={() => void submit("revoke")}>Revoke demo Premium</button>
    </div>
    {message && <p role="status" className="rw-assessment-note">{message}</p>}
    <p className="muted" style={{ fontSize: 12 }}>Use only disposable test accounts for the hackathon demonstration. Subscription cancellation, payment webhooks and billing are not implemented.</p>
  </div>;
}
