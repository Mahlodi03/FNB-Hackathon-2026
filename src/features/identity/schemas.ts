import { z } from "zod";

export const SignupRoleSchema = z.enum(["student", "employer"]);
export type SignupRole = z.infer<typeof SignupRoleSchema>;

export const SignupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(160),
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role: SignupRoleSchema,
});

export const LoginSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(72),
});

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => (v.length === 0 ? null : v));

export const ProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name").max(160),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or fewer")
    .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, "Use letters, numbers, hyphens or underscores"),
  institution: optionalText(160),
  fieldOfInterest: optionalText(120),
  bio: optionalText(1000),
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v.length === 0 ? null : v))
    .refine((v) => v === null || /^https:\/\/[^\s"'()<>]+$/.test(v), "Avatar must be an https link"),
  isPublic: z.boolean(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export const SEARCH_PAGE_SIZE = 12;

export const DirectoryQuerySchema = z.object({
  q: z.string().max(80).catch("").default(""),
  page: z.coerce.number().int().min(1).max(500).catch(1).default(1),
});

export const UuidSchema = z.uuid();
export const UsernameParamSchema = z.string().min(3).max(50).regex(/^[a-z0-9_-]+$/i);

export function safeRedirectPath(value: unknown, fallback = "/profile"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
