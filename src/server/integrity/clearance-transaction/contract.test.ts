/**
 * Phase 3B1 static migration contract checks. These cannot substitute for a
 * PostgreSQL integration test, concurrent-lock test, or full database review.
 * The transaction is NEVER called by this test suite.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../../../../supabase/migrations/20261025214500_integrity_system_clearance_transaction.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");

describe("Phase 3B1 system clearance database contract (static only)", () => {
  it("creates an independent system audit instead of forging a human reviewer", () => {
    expect(sql).toContain("create table public.integrity_system_clearance_history");
    expect(sql).toContain("actor_kind text not null default 'system'");
    expect(sql).not.toContain("insert into public.integrity_review_history");
    expect(sql).not.toContain("insert into public.integrity_review_state");
  });
  it("starts globally disabled", () => {
    expect(sql).toContain("enabled boolean not null default false");
    expect(sql).toContain("values (true, false)");
  });
  it("requires an individually allowlisted attempt", () => {
    expect(sql).toContain("create table public.integrity_auto_clearance_allowlist");
    expect(sql).toContain("where x.attempt_id = p_attempt_id for share");
    expect(sql).toContain("'not_allowlisted'");
  });
  it("restricts the RPC to the service role", () => {
    expect(sql).toContain("if (select auth.role()) is distinct from 'service_role'");
    expect(sql).toMatch(/revoke all on function public\.try_system_integrity_clearance\(uuid\) from public, anon, authenticated, service_role;/);
    expect(sql).toContain("grant execute on function public.try_system_integrity_clearance(uuid) to service_role");
  });
  it("does not grant service role power to change rollout gates directly", () => {
    expect(sql).toMatch(/revoke all on table public\.integrity_auto_clearance_settings, public\.integrity_auto_clearance_allowlist, public\.integrity_system_clearance_history from public, anon, authenticated, service_role/);
    expect(sql).toMatch(/grant select on table public\.integrity_auto_clearance_settings, public\.integrity_auto_clearance_allowlist, public\.integrity_system_clearance_history to service_role/);
  });
  it("enables RLS and creates no browser policies", () => {
    for (const name of ["integrity_auto_clearance_settings", "integrity_auto_clearance_allowlist", "integrity_system_clearance_history"]) {
      expect(sql).toContain(`alter table public.${name} enable row level security`);
    }
    expect(sql).not.toMatch(/create policy/i);
  });
  it("appends an immutable and unique audit", () => {
    expect(sql).toContain("attempt_id uuid not null unique references public.attempts(id)");
    expect(sql).toContain("before update or delete on public.integrity_system_clearance_history");
    expect(sql).toContain("public.reject_integrity_review_history_mutation()");
  });
  it("locks the same rows as existing human review", () => {
    expect(sql).toContain("for update of a, r");
    expect(sql).toContain("public.integrity_review_state");
    expect(sql).toContain("public.integrity_review_history");
  });
  it("never clears an ungraded or failing result", () => {
    expect(sql).toContain("v_attempt_status is distinct from 'graded'");
    expect(sql).toContain("v_passed is distinct from true");
    expect(sql).toContain("v_grading_source is distinct from 'ai_assisted'");
    expect(sql).toContain("v_result_visibility is distinct from 'withheld'");
  });
  it("enforces original submission timing and a settling delay", () => {
    expect(sql).toContain("v_submitted > v_expires");
    expect(sql).toContain("v_graded_at > v_now - interval '2 minutes'");
  });
  it("rejects camera and clipboard warning types in the pilot", () => {
    expect(sql).toContain("e.event_type not in ('window_blur', 'tab_hidden', 'fullscreen_exit')");
    expect(sql).toContain("if v_event_count > 2");
  });
  it("checks server receipt gaps and browser-reported unhealthy intervals", () => {
    expect(sql).toContain("v_receipt_count < 2 or v_receipt_count > 600");
    expect(sql).toContain("v_unhealthy_count > 0");
    expect(sql).toContain("v_max_gap_seconds > 60");
  });
  it("updates only visibility and records audit in one transaction", () => {
    expect(sql).toMatch(/update public\.results set visibility = 'published'/);
    expect(sql).toContain("insert into public.integrity_system_clearance_history");
    expect(sql).not.toMatch(/update public\.attempts set/i);
    expect(sql).not.toMatch(/set overall_score/i);
  });
  it("returns an idempotent response for existing system decisions", () => {
    expect(sql).toContain("'already_recorded'");
    expect(sql).toContain("where h.attempt_id = p_attempt_id");
  });
});
