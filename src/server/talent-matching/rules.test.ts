import {describe,expect,it} from "vitest";
import {ACTIVE_BRIEF_LIMIT,MONTHLY_MATCH_LIMIT,BriefActionSchema,RunSchema,ShortlistSchema,rankEvidenceCandidates,type EvidenceRow} from "./rules";
const records: EvidenceRow[] = [
  {student_id:"a",username:"alice",full_name:"Alice",field_of_interest:"Python",task_title:"SQL joins",concept:"Data analysis",skills:["SQL","Analytics"]},
  {student_id:"b",username:"bob",full_name:"Bob",field_of_interest:"SQL",task_title:"React interface",concept:"Frontend",skills:["React","CSS"]},
];
describe("employer AI matching rules",()=>{
  it("limits active briefs and monthly AI runs",()=>{
    expect(ACTIVE_BRIEF_LIMIT).toBe(3);expect(MONTHLY_MATCH_LIMIT).toBe(20);
  });
  it("rejects injected or oversized request payloads",()=>{
    expect(BriefActionSchema.safeParse({action:"create",brief:{title:"SQL analyst",description:"x".repeat(80),requiredSkills:["SQL"]},employerId:"fake"}).success).toBe(false);
    expect(RunSchema.safeParse({briefId:"not-uuid"}).success).toBe(false);
    expect(ShortlistSchema.safeParse({briefId:crypto.randomUUID(),studentId:crypto.randomUUID(),save:true,employerId:"other"}).success).toBe(false);
  });
  it("scores only matching published evidence, not field of interest",()=>{
    const c=rankEvidenceCandidates(records,["sql","data analysis"]);
    expect(c).toHaveLength(1);expect(c[0].username).toBe("alice");
    expect(c[0].coveragePercent).toBe(100);
  });
  it("does not reward names, biography, interest, or a Premium plan",()=>{
    const fake:EvidenceRow={...records[1],field_of_interest:"SQL analytics",full_name:"SQL expert"};
    expect(rankEvidenceCandidates([fake],["sql"])).toHaveLength(0);
  });
  it("returns no fabricated candidate if no evidence supports a skill",()=>{
    expect(rankEvidenceCandidates(records,["networking"])).toEqual([]);
  });
  it("bounds output and gives missing-skill context",()=>{
    const c=rankEvidenceCandidates(records,["sql","python"],100);
    expect(c).toHaveLength(1);expect(c[0].missingSkills).toEqual(["python"]);
    expect(c[0].evidence).toEqual(["SQL joins"]);
  });
});
