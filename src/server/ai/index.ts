import type { AssessmentAiService } from "@/contracts/services";
/** Person 3: replace with audited OpenAI structured-output implementation.
 * Never call the model from a Client Component; never invent demo scores. */
export const assessmentAi: AssessmentAiService = {
  async generateUnderstanding() {
    throw new Error("AI_NOT_IMPLEMENTED");
  },
  async evaluate() {
    throw new Error("AI_NOT_IMPLEMENTED");
  },
};
