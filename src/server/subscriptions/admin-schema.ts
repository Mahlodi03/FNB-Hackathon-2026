import { z } from "zod";

export const DemoEntitlementSchema = z.discriminatedUnion("action", [
  z.object({
    userId: z.string().uuid(),
    action: z.literal("grant"),
    days: z.number().int().min(1).max(90),
  }),
  z.object({
    userId: z.string().uuid(),
    action: z.literal("revoke"),
  }),
]);
