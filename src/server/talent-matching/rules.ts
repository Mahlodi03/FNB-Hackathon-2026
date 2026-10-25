import { z } from "zod";

export const ACTIVE_BRIEF_LIMIT = 3;
export const MONTHLY_MATCH_LIMIT = 20;
export const CANDIDATE_LIMIT = 8;

export const SKILL_TAGS = [
  "javascript", "typescript", "react", "html", "css", "accessibility", "frontend",
  "node", "api", "backend", "authentication", "sql", "database", "postgresql",
  "python", "data analysis", "data cleaning", "statistics", "visualization",
  "excel", "power bi", "machine learning", "testing", "debugging", "git",
  "algorithms", "data structures", "problem solving", "software architecture",
  "security", "networking", "cloud", "devops", "linux", "java", "c#",
  "communication", "documentation", "performance", "design",
] as const;
export const SkillTagSchema = z.enum(SKILL_TAGS);
export type SkillTag = z.infer<typeof SkillTagSchema>;

export const CreateBriefSchema = z.strictObject({
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(50).max(1600),
  requiredSkills: z.array(z.string().trim().min(2).max(40)).min(1).max(8),
});
export const BriefActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), brief: CreateBriefSchema }),
  z.strictObject({ action: z.literal("archive"), briefId: z.string().uuid() }),
]);
export const RunSchema = z.strictObject({ briefId: z.string().uuid() });
export const ShortlistSchema = z.strictObject({
  briefId: z.string().uuid(), studentId: z.string().uuid(), save: z.boolean(),
});

export type Brief = {
  id: string; title: string; description: string; required_skills: string[];
  status: "active" | "archived"; created_at: string;
};
export type EvidenceRow = {
  student_id: string; username: string; full_name: string; field_of_interest: string | null;
  task_title: string; concept: string; skills: string[] | null;
};
export type TalentCandidate = {
  studentId: string; username: string; fullName: string;
  coveragePercent: number; matchedSkills: SkillTag[]; missingSkills: SkillTag[];
  evidence: string[]; explanation: string;
};

// Skill normalization uses only published challenge metadata. No student demographic
// attributes, subscription status, integrity records, or private submissions are scored.
function tokenized(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").replace(/\s+/g, " ").trim()} `;
}
const ALIASES: Partial<Record<SkillTag, readonly string[]>> = {
  javascript: ["javascript", "js"], typescript: ["typescript", "ts"],
  react: ["react"], html: ["html"], css: ["css"],
  node: ["node", "nodejs"], api: ["api", "rest"],
  sql: ["sql", "queries", "joins"], database: ["database", "databases"],
  postgresql: ["postgresql", "postgres"], python: ["python"],
  "data analysis": ["data analysis", "analytics"], "data cleaning": ["data cleaning", "cleaning", "pipeline"],
  visualization: ["visualization", "chart", "dashboard"],
  testing: ["testing", "tests", "unit test"], debugging: ["debugging", "debug"],
  algorithms: ["algorithms", "algorithm"], "data structures": ["data structures", "arrays", "hash maps", "graphs"],
  "problem solving": ["problem solving"],
  security: ["security", "cybersecurity"], authentication: ["authentication", "auth"],
};
function hasSkill(haystack: string, skill: SkillTag) {
  return (ALIASES[skill] ?? [skill]).some(term => haystack.includes(tokenized(term)));
}

/** Candidate identifiers only originate from a service-role, consent-filtered DB projection. */
export function rankEvidenceCandidates(rows: readonly EvidenceRow[], skills: readonly SkillTag[], max = CANDIDATE_LIMIT): TalentCandidate[] {
  const grouped = new Map<string, {username:string;fullName:string;skills:Set<SkillTag>;titles:Set<string>}>();
  for (const r of rows) {
    if (!r.student_id || !r.username) continue;
    const existing = grouped.get(r.student_id) ?? {
      username:r.username, fullName:r.full_name?.trim() || r.username,
      skills:new Set<SkillTag>(), titles:new Set<string>(),
    };
    // Published evidence only; no profile bio or field_of_interest in the ranking.
    const proof = tokenized([r.task_title,r.concept,...(r.skills??[])].join(" "));
    for (const skill of skills) if (hasSkill(proof,skill)) existing.skills.add(skill);
    if (existing.titles.size < 5) existing.titles.add(r.task_title.slice(0,100));
    grouped.set(r.student_id,existing);
  }
  return [...grouped].map(([studentId,r])=>{
    const matchedSkills = skills.filter(s=>r.skills.has(s));
    const missingSkills = skills.filter(s=>!r.skills.has(s));
    const coveragePercent = skills.length ? Math.round(matchedSkills.length / skills.length * 100) : 0;
    return {
      studentId, username:r.username, fullName:r.fullName,
      coveragePercent, matchedSkills, missingSkills, evidence:[...r.titles].slice(0,3),
      explanation: matchedSkills.length
        ? `${matchedSkills.length} of ${skills.length} target skills appear in published passing challenge evidence. Other skills are not yet evidenced here.`
        : "No selected target skills are evidenced by the available published passing challenges.",
    };
  }).filter(c=>c.matchedSkills.length > 0)
    .sort((a,b)=>b.coveragePercent-a.coveragePercent || b.evidence.length-a.evidence.length || a.username.localeCompare(b.username))
    .slice(0, Math.max(0,Math.min(max,CANDIDATE_LIMIT)));
}
