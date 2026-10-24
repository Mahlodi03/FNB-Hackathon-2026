import { describe, expect, it, vi } from "vitest";
import { exampleTask } from "../../features/grading/example-task.test-data";

// Vitest runs outside Next.js; this shim affects tests only.
vi.mock("server-only", () => ({}));

describe("live AI evaluation (opt-in, costs API tokens)", () => {
  it.skipIf(process.env.RUN_LIVE_OPENAI !== "true")(
    "returns rubric-aligned section grades from the actual OpenAI API",
    async () => {
      process.loadEnvFile(".env.local");
      const { assessmentAi } = await import("./index");
      const result = await assessmentAi.evaluate({
        task: exampleTask,
        understandingQuestion: "Why did you create Engine inside Car rather than inject it?",
        submission: {
          theoryAnswer: "Composition lets objects collaborate without inheritance coupling.",
          practicalAnswer: "class Engine {}\nclass Car { engine = new Engine(); }",
          understandingAnswer: "Direct creation is simple but makes testing and substituting an Engine harder.",
        },
      });
      for (const score of Object.values(result.scores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
      expect(result.feedback.length).toBeGreaterThanOrEqual(10);
      console.info("AI evaluation (fictional submission):", result);
    },
    90_000,
  );
});
