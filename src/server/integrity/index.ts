import type { AssessmentPolicy } from "@/contracts/services";
/** Person 4: verify server-stored evidence; don't pretend client signals prove identity. */
export const assessmentPolicy: AssessmentPolicy = {
  async checkSnapshot() {
    throw new Error("INTEGRITY_NOT_IMPLEMENTED");
  },
};
