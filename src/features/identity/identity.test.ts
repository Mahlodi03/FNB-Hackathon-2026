import { describe, expect, it } from "vitest";
import { toPublicStudent, toResultCard, initials } from "./mappers";
import { DirectoryQuerySchema, LoginSchema, ProfileUpdateSchema, SignupSchema, safeRedirectPath } from "./schemas";
import { buildDirectoryFilter, cleanSearchTerm, pageRange } from "./search";

const validSignup = { fullName: "Thandi Mokoena", email: "thandi@example.com", password: "longenough1", role: "student" };

const validProfile = {
  fullName: "Thandi Mokoena",
  username: "Thandi_M",
  institution: "",
  fieldOfInterest: "Software Engineering",
  bio: "",
  avatarUrl: "",
  isPublic: true,
};

describe("signup validation", () => {
  it("accepts student and employer roles", () => {
    expect(SignupSchema.safeParse(validSignup).success).toBe(true);
    expect(SignupSchema.safeParse({ ...validSignup, role: "employer" }).success).toBe(true);
  });

  it("never accepts admin or unknown roles", () => {
    expect(SignupSchema.safeParse({ ...validSignup, role: "admin" }).success).toBe(false);
    expect(SignupSchema.safeParse({ ...validSignup, role: "" }).success).toBe(false);
    expect(SignupSchema.safeParse({ ...validSignup, role: "ADMIN" }).success).toBe(false);
  });

  it("rejects short passwords and invalid emails", () => {
    expect(SignupSchema.safeParse({ ...validSignup, password: "short" }).success).toBe(false);
    expect(SignupSchema.safeParse({ ...validSignup, email: "not-an-email" }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("profile update validation", () => {
  it("normalises username and turns empty optional fields into null", () => {
    const parsed = ProfileUpdateSchema.parse(validProfile);
    expect(parsed.username).toBe("thandi_m");
    expect(parsed.institution).toBeNull();
    expect(parsed.avatarUrl).toBeNull();
  });

  it("does not accept a role field", () => {
    const parsed = ProfileUpdateSchema.parse({ ...validProfile, role: "admin" });
    expect("role" in parsed).toBe(false);
  });

  it("rejects unsafe usernames and non-https avatars", () => {
    expect(ProfileUpdateSchema.safeParse({ ...validProfile, username: "a b" }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ ...validProfile, username: "-bad" }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ ...validProfile, avatarUrl: "http://x.com/a.png" }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ ...validProfile, avatarUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ ...validProfile, avatarUrl: "https://x.com/a.png" }).success).toBe(true);
  });

  it("bounds oversized text", () => {
    expect(ProfileUpdateSchema.safeParse({ ...validProfile, bio: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("directory search", () => {
  it("strips characters that could alter the PostgREST filter", () => {
    expect(cleanSearchTerm("Pretoria),role.eq.admin,(x")).toBe("Pretoria role.eq.admin x");
    expect(cleanSearchTerm('a%b\\c"d*e')).toBe("a b c d e");
  });

  it("builds one quoted ilike clause per searchable column", () => {
    const filter = buildDirectoryFilter("Data Science");
    expect(filter).toBe(
      'full_name.ilike."%Data Science%",username.ilike."%Data Science%",institution.ilike."%Data Science%",field_of_interest.ilike."%Data Science%"'
    );
  });

  it("returns no filter for empty or symbol-only input", () => {
    expect(buildDirectoryFilter("   ")).toBeNull();
    expect(buildDirectoryFilter("%%(),")).toBeNull();
  });

  it("bounds query length and page numbers", () => {
    expect(cleanSearchTerm("a".repeat(500)).length).toBe(60);
    expect(DirectoryQuerySchema.parse({ q: "x".repeat(200), page: "2" })).toEqual({ q: "", page: 2 });
    expect(DirectoryQuerySchema.parse({ q: "ok", page: "-4" }).page).toBe(1);
    expect(DirectoryQuerySchema.parse({ q: "ok", page: "99999" }).page).toBe(1);
    expect(pageRange(3, 12)).toEqual({ from: 24, to: 35 });
  });
});

describe("redirect safety", () => {
  it("only allows same-site paths", () => {
    expect(safeRedirectPath("/students")).toBe("/students");
    expect(safeRedirectPath("https://evil.com")).toBe("/profile");
    expect(safeRedirectPath("//evil.com")).toBe("/profile");
    expect(safeRedirectPath("/\\evil.com")).toBe("/profile");
    expect(safeRedirectPath(undefined)).toBe("/profile");
  });
});

describe("mappers", () => {
  it("maps public rows and drops unsafe avatar links", () => {
    const student = toPublicStudent({
      id: "20000000-0000-4000-8000-000000000001",
      username: "thandi-m",
      full_name: "",
      institution: null,
      field_of_interest: "SQL",
      bio: null,
      avatar_url: "http://insecure.example/a.png",
    });
    expect(student).toMatchObject({ fullName: "thandi-m", avatarUrl: null, fieldOfInterest: "SQL" });
  });

  it("rounds numeric scores returned as strings", () => {
    const card = toResultCard({
      attempt_id: "a",
      task_id: "t",
      task_title: "Two-sum problem",
      concept: "Algorithms",
      skills: null,
      overall_score: "86.40",
      graded_at: "2026-10-17T10:00:00Z",
    });
    expect(card.overallScore).toBe(86);
    expect(card.skills).toEqual([]);
  });

  it("builds initials", () => {
    expect(initials("Thandi Mokoena")).toBe("TM");
    expect(initials("")).toBe("?");
  });
});
