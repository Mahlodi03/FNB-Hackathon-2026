import { describe, expect, it, vi } from "vitest";
import { exampleTask } from "../../features/grading/example-task.test-data";

// Vitest runs outside Next.js; this shim affects tests only.
vi.mock("server-only", () => ({}));

describe("live understanding question (opt-in, costs API tokens)", () => {
  it.skipIf(process.env.RUN_LIVE_OPENAI !== "true")(
    "generates one specific question from the actual OpenAI API",
    async () => {
      process.loadEnvFile(".env.local");
      const { assessmentAi } = await import("./index");
      const result = await assessmentAi.generateUnderstanding({
        task: exampleTask,
        theoryAnswer: "Composition reuses behaviours without coupling classes in an inheritance tree.",
        practicalAnswer: "class Engine {}\nclass Car { engine = new Engine(); }",
      });
      expect(result.question.length).toBeGreaterThanOrEqual(12);
      expect(result.question.endsWith("?")).toBe(true);
      console.info("Generated understanding question:", result.question);
    },
    60_000,
  );
});
