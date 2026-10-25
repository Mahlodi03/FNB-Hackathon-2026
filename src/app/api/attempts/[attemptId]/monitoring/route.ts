import { NextRequest, NextResponse } from "next/server";
import { AccessError, requireActor } from "@/server/auth/actor";
import { serviceSupabase } from "@/lib/supabase/admin";
import { ingestMonitoringReceipt, type MonitoringReceiptStore } from "@/server/integrity/monitoring-coverage";
import type { AttemptForIntegrity } from "@/server/integrity/rules";

const noStore = { "Cache-Control": "no-store" };
function reply(body: unknown, status: number) { return NextResponse.json(body, { status, headers: noStore }); }

async function readSmallJson(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("No body");
  let bytes = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 512) { void reader.cancel(); throw new Error("Too large"); }
    parts.push(value);
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) { joined.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
}

/** Authenticated, per-attempt telemetry transport receipt, never an integrity decision. */
export async function POST(request: NextRequest, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const actor = await requireActor(["student"]);
    const { attemptId } = await context.params;
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return reply({ error: "Cross-origin request denied" }, 403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return reply({ error: "Expected JSON" }, 415);
    }
    if (Number(request.headers.get("content-length") ?? 0) > 512) return reply({ error: "Request too large" }, 413);
    let body: unknown;
    try { body = await readSmallJson(request); }
    catch { return reply({ error: "Invalid or oversized monitoring receipt" }, 422); }

    const db = serviceSupabase();
    const store: MonitoringReceiptStore = {
      async getAttempt(id) {
        const { data, error } = await db.from("attempts")
          .select("id,student_id,status,expires_at").eq("id", id).maybeSingle();
        if (error) throw new Error("Unable to inspect monitoring attempt");
        return data as AttemptForIntegrity | null;
      },
      async record(id, bucket, claims) {
        // Atomic across server instances; later reports in the same bucket cannot overwrite first.
        const { error } = await db.from("integrity_monitor_receipts").upsert({
          attempt_id: id,
          time_bucket: bucket,
          camera_track_live: claims.cameraTrackLive,
          fullscreen_active: claims.fullscreenActive,
          page_visible: claims.pageVisible,
        }, { onConflict: "attempt_id,time_bucket", ignoreDuplicates: true });
        if (error) throw new Error("Unable to save monitoring receipt");
      },
    };
    const result = await ingestMonitoringReceipt({ attemptId, body, studentId: actor.userId, role: actor.role }, store);
    return reply(result.body, result.status);
  } catch (error) {
    if (error instanceof AccessError) return reply({ error: error.message }, error.status);
    // Do not expose private DB tables or monitoring internals.
    console.error("Monitoring receipt unavailable", error instanceof Error ? error.message : "unknown error");
    return reply({ error: "Monitoring receipt unavailable" }, 503);
  }
}
