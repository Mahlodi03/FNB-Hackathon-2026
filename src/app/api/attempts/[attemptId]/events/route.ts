import { NextRequest, NextResponse } from "next/server";
import { AccessError, requireActor } from "@/server/auth/actor";
import { integrityEventStore } from "@/server/integrity/db";
import { ingestIntegrityEvent } from "@/server/integrity/ingest";
import { withAttemptAdmissionLock } from "@/server/integrity/lock";

export async function POST(request: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const actor = await requireActor(["student"]);
    const { attemptId } = await context.params;
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Cross-origin submission denied", code: "ORIGIN_FORBIDDEN" }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Expected JSON", code: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
    }
    if (Number(request.headers.get("content-length") ?? 0) > 4096) {
      return NextResponse.json({ error: "Request too large", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    // Hard byte cap even for chunked requests with no Content-Length header.
    let raw = "";
    try {
      const reader = request.body?.getReader();
      if (!reader) return NextResponse.json({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 422 });
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) {
          void reader.cancel();
          return NextResponse.json({ error: "Request too large", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
        }
        chunks.push(value);
      }
      const combined = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
      raw = new TextDecoder("utf-8", { fatal: true }).decode(combined);
    } catch { return NextResponse.json({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 422 }); }
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch { return NextResponse.json({ error: "Invalid JSON", code: "INVALID_JSON" }, { status: 422 }); }
    const result = await withAttemptAdmissionLock(attemptId, () => ingestIntegrityEvent(
      { attemptId, body, studentId: actor.userId, role: actor.role }, integrityEventStore(),
    ));
    return NextResponse.json(result.body, { status: result.status,
      headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AccessError) {
      return NextResponse.json({ error: error.message, code: error.status === 401 ? "UNAUTHENTICATED" : "ROLE_FORBIDDEN" }, { status: error.status });
    }
    // Do not disclose database failures, event history, internal policy, or credentials.
    return NextResponse.json({ error: "Unable to save integrity event", code: "INTEGRITY_UNAVAILABLE" }, { status: 503 });
  }
}
