# Person 4 → Person 2 integration handoff

Owner: `feature/integrity-review`. This folder exports a browser component and hook; **P2**, not P4, edits `src/app/assessment/[taskId]/page.tsx` after both PRs merge.

## Component API

```tsx
import { IntegrityMonitor } from "@/features/integrity/IntegrityMonitor";

<IntegrityMonitor
  attemptId={attemptId || undefined} // must come from POST /api/attempts/start
  strictScreenMode={false} // optional; TRUE requires experimental screen permission
  onReady={() => setPreflightReady(true)} // optional callback after successful checks
/>
```

- Mount before starting an attempt if preflight is a prerequisite; preflight works with `attemptId` omitted. Set `attemptId` from P2's authenticated start response after the checks; active monitoring begins when both the preflight is ready and ID is supplied.
- P2 must enforce `onReady`/preflight completion before allowing the assessment to start. P2 must not rely on the callback alone for secure server rules; user-side data is advisory.
- On unmount or clicking **Stop**, the video tracks stop and event listeners detach. Mount through the active session (avoid remounting on each question). On final submission, unmount it (P2 owns this).
- Camera permissions: `{ video: true, audio: false }`; local `<video>` preview only. No bytes, frames or microphone data leave the browser.
- Full-screen needs a user gesture, a desktop pointer and a secure context (HTTPS/localhost). Declined permissions or unsupported browsers block preflight with a neutral explanation.
- `strictScreenMode=true` additionally needs experimental `window.getScreenDetails()` with explicit permission. In regular mode this API is optional and not requested. This detects *reported display changes*, **not** off-screen phones or all secondary devices. Browser permission dialogs can prevent simultaneous gesture-gated requests in some browsers; test your target browser.
- Observer signals: `tab_hidden`, `window_blur`, `fullscreen_exit`, `copy_attempt`, `paste_attempt`, `camera_track_ended`, `display_change` (screen-capable sessions). Each uses `POST /api/attempts/:attemptId/events` with `{eventType,occurredAt}`.
- Client reduces duplicates for each event type to once per 5 s, and sends at most 15 events per minute. Server independently enforces its own limits. Network delivery is best-effort; browsers may cancel requests during abrupt navigation.
- A reported camera interruption is a technical exception, **not a cheating judgment**. P2 should read `assessmentPolicy.checkSnapshot({attemptId,taskRubric})` from `@/server/integrity` on its server-side submit flow, and handle `disqualifyingTechnicalFailure` separately from `reviewRecommended`. P2/integrator should define technical-invalidated attempt flow and retry exceptions before using it to change attempt status.
- `flaggedEventCount` is total server-stored events, `reviewRecommended` is true if there are recorded signals, and technical loss is true if a `camera_track_ended` or `permission_lost` event was reported. Current flags are *reported and unverified*; they do not prove misconduct.
- Optional MediaPipe face-count analysis is **deferred**. No face detection, landmarks, or images are uploaded. No look-away, voice monitoring, recognition of phones or AI extensions, and no automatic accusations.

## Backend limitations and handoff requests

1. `integrity_events` has no review status/decision columns. Admin UI is read-only; any auditable reviewer decision requires an integrator-approved migration and contract PR. No fake review decision is written.
2. Rate limiting uses recent server-stored event queries, cooldown and a per-attempt cap. This is not an **atomic cross-instance guarantee** under concurrent requests. For production, the integrator should approve a database RPC or transaction with locking/unique keys (plus per-IP and auth-user perimeter throttling). Current MVP requests cannot be claimed to be completely resistant to distributed floods.
3. Browser-observed events can be spoofed, missed, or caused by innocuous behaviour. Do not use alone to punish students. Ensure private admin review and documented retention/appeals before production.
4. P1 must supply real authenticated student accounts and P2 must supply real attempts; the scaffold's `start` route still returns 501 on the uploaded `develop` snapshot. Live API testing needs real Supabase credentials and the existing migration. Never commit secrets.

## Manual acceptance checklist (real credentials required)

Use two authenticated student accounts, one admin and one employer. Create a real active attempt through P2's route (not from fictional fixtures). Send `POST /api/attempts/<uuid>/events` from the session-owning student with `Content-Type: application/json` and body:

```json
{"eventType":"tab_hidden","occurredAt":"2026-10-21T13:00:00.000Z"}
```

Expected success: HTTP 200, `{"accepted":true,"eventCount":1,"reviewRecommended":true}` for a first signal in a fresh attempt. The DB `recorded_at` is the actual server time, not this example client timestamp. Repeating the same type within 5 seconds should return the current DB count without another record. Sending more than 15 distinct eligible events inside 60 seconds should return 429; the per-attempt overall cap is 250. Test concurrent sends in a production-like environment because query-based cross-instance throttling is not atomic.

Expected failures: unauthenticated 401, employer 403, second student's attempt 403, inactive/expired attempt 409, invalid UUID or unknown type or spoofed fields 422, non-JSON 415, cross-origin 403, excessive payload 413. An attempt that does not exist returns 404. Other DB failures return a generic 503 with no private information.

In a secure browser, test allowing and declining camera, disabled full-screen, tab hide, paste, copying, physically unplugging camera, and unmount while monitoring. Ensure microphone permission never appears and that unmount stops all tracks. Check `/admin/integrity` while logged in as a student (must not reveal events), then as an admin (shows only private incident history). No auditable admin decisions are persisted in schema v1.
