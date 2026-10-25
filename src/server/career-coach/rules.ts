import { z } from "zod";

export const CAREER_COACH_DAILY_LIMIT = 5;
export const CAREER_COACH_COOLDOWN_SECONDS = 60;

/** Fixed career goals keep student input out of system/model instructions. */
export const CareerGoalSchema = z.enum([
  "frontend_developer", "backend_developer", "data_analyst",
  "software_engineer", "cybersecurity_analyst",
]);
export type CareerGoal = z.infer<typeof CareerGoalSchema>;
export const CareerCoachRequestSchema = z.strictObject({ goal: CareerGoalSchema });

export const CAREER_GOALS: Record<CareerGoal, { label: string; keywords: readonly string[] }> = {
  frontend_developer: { label: "Frontend Developer", keywords: ["frontend", "react", "javascript", "typescript", "html", "css", "web", "ui", "accessibility", "component"] },
  backend_developer: { label: "Backend Developer", keywords: ["backend", "api", "server", "database", "sql", "node", "authentication", "data", "architecture"] },
  data_analyst: { label: "Data Analyst", keywords: ["data", "sql", "analysis", "analytics", "cleaning", "pipeline", "statistics", "python", "reporting"] },
  software_engineer: { label: "Software Engineer", keywords: ["algorithm", "data", "structure", "testing", "debug", "code", "architecture", "software", "git", "programming"] },
  cybersecurity_analyst: { label: "Cybersecurity Analyst", keywords: ["security", "cyber", "auth", "vulnerab", "network", "permission", "crypt", "incident", "risk", "access"] },
};

export type PublishedChallenge = {
  id: string; slug: string; title: string; concept: string;
  difficulty: string; skills: string[]; durationSeconds: number;
};
export type PublishedEvidence = {
  title: string; concept: string; skills: string[]; score: number;
};
export type RecommendedChallenge = PublishedChallenge & { alreadyStarted: boolean };

function textTokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
}

/** Deterministic, DB-backed recommendations. An AI response cannot create task IDs. */
export function recommendPublishedChallenges(
  goal: CareerGoal, challenges: readonly PublishedChallenge[],
  startedTaskIds: ReadonlySet<string>, evidence: readonly PublishedEvidence[],
  limit = 4,
): RecommendedChallenge[] {
  const keywords = CAREER_GOALS[goal].keywords;
  const demonstrated = new Set(evidence.flatMap(e => [e.concept, ...e.skills]).flatMap(textTokens));
  const ranked = challenges.map(task => {
    const tokens = textTokens([task.title, task.concept, ...task.skills].join(" "));
    const matches = keywords.filter(k => tokens.some(t => t.startsWith(k) || k.startsWith(t) && t.length >= 4)).length;
    const novelty = tokens.filter(t => !demonstrated.has(t) && t.length >= 4).length;
    const alreadyStarted = startedTaskIds.has(task.id);
    return { ...task, alreadyStarted, _rank: matches * 100 + Math.min(novelty, 12) - (alreadyStarted ? 1000 : 0) };
  });
  ranked.sort((a,b) => b._rank - a._rank || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  // Do not label unrelated challenges as role-specific recommendations.
  // If there is no role match, show only generic published practice options.
  return ranked.slice(0, Math.max(0, Math.min(limit, 6))).map(task => ({
    id: task.id, slug: task.slug, title: task.title, concept: task.concept,
    difficulty: task.difficulty, skills: task.skills, durationSeconds: task.durationSeconds,
    alreadyStarted: task.alreadyStarted,
  }));
}

export function safeEvidence(rows: readonly PublishedEvidence[]): PublishedEvidence[] {
  return rows.slice(0, 8).map(r => ({
    title: r.title.slice(0, 120), concept: r.concept.slice(0, 90),
    skills: r.skills.slice(0, 8).map(s => s.slice(0, 50)),
    score: Math.min(100, Math.max(0, Math.round(r.score))),
  }));
}
