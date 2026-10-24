import type { Metadata } from "next";
import { AppShell } from "@/features/shell/AppShell";
import { getSessionProfile } from "@/features/identity/queries";
import { isSupabaseConfigured } from "@/features/identity/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ready For Work | Demonstrate your skills",
  description: "Build a work-readiness profile with real IT challenges, AI-assisted feedback and privacy-conscious integrity review.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Navigation only reflects the authenticated database role; never a role switcher.
  const profile = isSupabaseConfigured() ? await getSessionProfile() : null;
  const identity = profile ? {
    role: profile.role,
    name: profile.fullName || profile.username,
    username: profile.username,
  } : null;
  return <html lang="en"><body><AppShell identity={identity}>{children}</AppShell></body></html>;
}
