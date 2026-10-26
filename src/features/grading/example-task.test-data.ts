import type { Task } from "../../contracts/domain";

/** Fictional fixture, deliberately independent of demo pages and shared tests. */
export const exampleTask: Task = {
  id: "10000000-0000-4000-8000-000000000001",
  slug: "oop-composition-test",
  title: "Inheritance vs composition",
  concept: "OOP",
  difficulty: "beginner",
  durationSeconds: 1800,
  theoryPrompt: "Explain when composition is preferable to inheritance in OOP.",
  practicalPrompt: "Write a Car class using composition to own an Engine instance.",
  understandingGuidance: "Ask a targeted question about an actual implementation choice or edge case.",
  rubric: {
    theoryWeight: 30,
    practicalWeight: 50,
    understandingWeight: 20,
    theoryCriteria: ["Explains the relationship tradeoffs"],
    practicalCriteria: ["Solution plausibly implements composition"],
    understandingCriteria: ["Explains the choice and a tradeoff"],
  },
  passMark: 70,
  skills: ["OOP", "Software design"],
  status: "published",
};
