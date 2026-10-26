"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";
import { serviceSupabase } from "@/lib/supabase/admin";
import { AccessError, requireActor } from "@/server/auth/actor";
import { isServiceRoleConfigured, isSupabaseConfigured } from "./config";
import { LoginSchema, ProfileUpdateSchema, SignupSchema, UuidSchema, safeRedirectPath } from "./schemas";

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const NOT_CONFIGURED: FormState = {
  status: "error",
  message: "Sign-in is not available yet because Supabase is not configured for this environment.",
};

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = SignupSchema.safeParse({
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    role: text(formData, "role"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const { fullName, email, password, role } = parsed.data;
  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/login/callback?next=/profile`,
    },
  });
  if (error) {
    const weak = error.code === "weak_password";
    return {
      status: "error",
      message: weak ? "That password is too weak. Try a longer one." : "We could not create your account. Please try again.",
    };
  }
  if (data.session) redirect("/profile");
  return {
    status: "success",
    message: "Check your email for a confirmation link to finish creating your account.",
  };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = LoginSchema.safeParse({ email: text(formData, "email"), password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const supabase = await serverSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = error.code === "email_not_confirmed";
    return {
      status: "error",
      message: unconfirmed ? "Please confirm your email address before logging in." : "Incorrect email or password.",
    };
  }
  redirect(safeRedirectPath(text(formData, "next"), "/dashboard"));
}

export async function signInWithGoogleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const next = safeRedirectPath(text(formData, "next"), "/dashboard");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/login/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return { status: "error", message: "Google sign-in is not available right now." };
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await serverSupabase();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  let actor;
  try {
    actor = await requireActor(["student", "employer"]);
  } catch (error) {
    if (error instanceof AccessError) return { status: "error", message: "Please log in again to edit your profile." };
    throw error;
  }
  const parsed = ProfileUpdateSchema.safeParse({
    fullName: text(formData, "fullName"),
    username: text(formData, "username"),
    institution: text(formData, "institution"),
    fieldOfInterest: text(formData, "fieldOfInterest"),
    bio: text(formData, "bio"),
    avatarUrl: text(formData, "avatarUrl"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }
  const p = parsed.data;
  const supabase = await serverSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: p.fullName,
      username: p.username,
      institution: p.institution,
      field_of_interest: p.fieldOfInterest,
      bio: p.bio,
      avatar_url: p.avatarUrl,
      is_public: actor.role === "student" ? p.isPublic : false,
    })
    .eq("id", actor.userId);
  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "That username is taken.", fieldErrors: { username: "That username is taken" } };
    }
    return { status: "error", message: "We could not save your profile. Please try again." };
  }
  revalidatePath("/profile");
  revalidatePath("/students", "layout");
  return { status: "success", message: "Profile saved." };
}

export async function setSubmissionSharingAction(attemptId: string, share: boolean): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  if (!UuidSchema.safeParse(attemptId).success || typeof share !== "boolean") {
    return { status: "error", message: "Invalid request." };
  }
  let actor;
  try {
    actor = await requireActor(["student"]);
  } catch (error) {
    if (error instanceof AccessError) return { status: "error", message: "Please log in again." };
    throw error;
  }
  if (!isServiceRoleConfigured()) {
    return { status: "error", message: "Sharing settings are not available yet in this environment." };
  }
  const supabase = await serverSupabase();
  const { data: owned, error: ownError } = await supabase
    .from("attempts")
    .select("id")
    .eq("id", attemptId)
    .eq("student_id", actor.userId)
    .maybeSingle();
  if (ownError || !owned) return { status: "error", message: "You can only change sharing for your own results." };
  const { error } = await serviceSupabase()
    .from("attempts")
    .update({ share_submission: share })
    .eq("id", attemptId)
    .eq("student_id", actor.userId);
  if (error) return { status: "error", message: "We could not update sharing. Please try again." };
  revalidatePath("/profile");
  revalidatePath("/students", "layout");
  return { status: "success", message: share ? "Your answers are now visible to employers." : "Your answers are now hidden." };
}
