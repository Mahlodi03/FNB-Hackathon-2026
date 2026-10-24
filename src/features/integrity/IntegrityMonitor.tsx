"use client";

import { useIntegrityMonitor, type IntegrityMonitorOptions } from "./useIntegrityMonitor";

/** Embed in P2's workspace. Preflight works without attemptId; monitoring begins when ID is set. */
export function IntegrityMonitor(props: IntegrityMonitorOptions) {
  const { videoRef, status, notice, screenCapability, eventCount, rulesAccepted, setRulesAccepted, startPreflight, stop } = useIntegrityMonitor(props);
  return <section className="card" aria-label="Assessment integrity preflight" style={{ display: "grid", gap: 16, maxWidth: 750 }}>
    <div>
      <p className="eyebrow">Privacy-aware assessment integrity</p>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>Camera and browser preflight</h2>
      <p className="muted" style={{ marginTop: 10 }}>Desktop/laptop only. Your camera is checked locally to confirm an active video stream. No microphone, camera frames, audio or recordings are sent to the server.</p>
    </div>
    <div style={{ background: "#081d29", borderRadius: 12, padding: 16, fontSize: 14 }}>
      <strong>During the assessment we record:</strong>
      <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.9 }}>
        <li>Tab hiding, window blur and leaving full-screen</li>
        <li>Copy/paste attempts and a stopped camera track</li>
        <li>Display configuration changes only if supported and permission was granted</li>
      </ul>
      <p className="muted" style={{ marginTop: 10 }}>These signals can be caused by normal browser or device behaviour. They are not proof of cheating, and any review is private to authorized administrators.</p>
      <p className="muted" style={{ marginTop: 8 }}>Second-screen detection is experimental and cannot see hidden phones or every connected device.</p>
    </div>
    <p className="muted" style={{ fontSize: 13 }}>Screen capability: <strong>{screenCapability}</strong>{props.strictScreenMode ? " · Strict mode requires screen permission." : " · Screen permission is not required for this assessment."}</p>
    <label style={{ display: "flex", alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
      <input type="checkbox" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} disabled={status === "ready" || status === "checking"} style={{ marginTop: 4 }} />
      <span>I have read the assessment rules and privacy notice, and agree to camera-only preflight and browser-event monitoring.</span>
    </label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {status !== "ready" && status !== "checking" && <button className="button" type="button" onClick={() => void startPreflight()} disabled={!rulesAccepted}>Run preflight</button>}
      {status === "ready" && <button className="button secondary" type="button" onClick={stop}>Stop camera and monitoring</button>}
    </div>
    <video ref={videoRef} muted autoPlay playsInline aria-label="Local camera preview" style={{ width: "100%", maxWidth: 340, aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12, background: "#04131d", display: status === "ready" ? "block" : "none" }} />
    <p role="status" aria-live="polite" className="muted">
      {status === "ready" ? (props.attemptId ? "Preflight passed. Monitoring is active for this attempt." : "Preflight passed. Waiting for the assessment attempt ID before sending events.") : `Preflight: ${status}.`}
      {eventCount !== null ? ` ${eventCount} signal(s) stored for private review.` : ""}
    </p>
    {notice && <p role="alert" style={{ border: "1px solid #94774a", padding: 12, borderRadius: 9 }}>{notice}</p>}
  </section>;
}
