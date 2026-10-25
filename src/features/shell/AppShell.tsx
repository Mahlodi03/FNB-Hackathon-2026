"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight, BookOpen, BriefcaseBusiness, ClipboardCheck, Files,
  Home, LayoutDashboard, LogIn, ShieldCheck, Sparkles, UserRound,
  UsersRound, type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";

type Role = "student" | "employer" | "admin";
type NavItem = { href: string; label: string; icon: LucideIcon };

const studentNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Challenges", icon: BookOpen },
  { href: "/progress", label: "My Progress", icon: ClipboardCheck },
  { href: "/career-coach", label: "AI Career Coach", icon: Sparkles },
  { href: "/evidence", label: "My Evidence", icon: Files },
  { href: "/students", label: "Students", icon: UsersRound },
  { href: "/profile", label: "My Profile", icon: UserRound },
];
const employerNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: UsersRound },
  { href: "/profile", label: "My Profile", icon: BriefcaseBusiness },
];
const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: UsersRound },
  { href: "/admin/tasks", label: "Manage Tasks", icon: BookOpen },
  { href: "/admin/integrity", label: "Integrity Review", icon: ShieldCheck },
  { href: "/profile", label: "My Profile", icon: UserRound },
];
const publicNavigation: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Challenges", icon: BookOpen },
];

export function AppShell({
  children, identity,
}: {
  children: ReactNode;
  identity: { role: Role; name: string; username: string } | null;
}) {
  const pathname = usePathname();
  const authPage = pathname === "/login" || pathname === "/signup";
  const landing = pathname === "/";
  const nav = identity?.role === "student" ? studentNavigation
    : identity?.role === "employer" ? employerNavigation
      : identity?.role === "admin" ? adminNavigation : publicNavigation;
  const roleLabel = identity?.role === "student" ? "Student"
    : identity?.role === "employer" ? "Employer" : identity?.role === "admin" ? "Admin" : "Visitor";
  const initials = identity?.name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join("") || "RW";
  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  if (authPage) return <div className="rw-auth-page"><main id="main-content" className="rw-auth-content">{children}</main></div>;

  if (landing && !identity) return (
    <div className="rw-public-page">
      <header className="rw-public-header">
        <BrandLogo />
        <nav aria-label="Public navigation" className="rw-public-links">
          <Link href="/">Home</Link>
          <Link href="/tasks">Challenges</Link>
          <Link href="/login">Log in</Link>
          <Link className="button rw-public-cta" href="/signup">Get started <ArrowRight size={16} /></Link>
        </nav>
      </header>
      <main id="main-content" className="rw-public-main">{children}</main>
    </div>
  );

  return (
    <div className="rw-app">
      <aside className="rw-sidebar" aria-label="Sidebar">
        <div className="rw-sidebar-brand"><BrandLogo compact /></div>
        <div className="rw-user-block">
          <span className="rw-avatar" aria-hidden="true">{initials}</span>
          <div><strong>{identity?.name ?? "Ready For Work"}</strong><small>{identity ? `${roleLabel} workspace` : "Explore the platform"}</small></div>
        </div>
        <span className="rw-nav-label">{identity ? "YOUR WORKSPACE" : "EXPLORE"}</span>
        <nav className="rw-side-links" aria-label="Workspace navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link className={`rw-side-link ${isActive(href) ? "active" : ""}`} href={href} key={href} aria-current={isActive(href) ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.9} /> {label}
            </Link>
          ))}
          {!identity && <Link className="rw-side-link" href="/login"><LogIn size={18}/> Log in</Link>}
        </nav>
        <div className="rw-sidebar-bottom">
          <div className="rw-side-help"><ShieldCheck size={18}/><span>Real skills. Responsible assessment.</span></div>
          <small>Ready For Work · Hackathon 2026</small>
        </div>
      </aside>
      <div className="rw-workspace">
        <header className="rw-topbar">
          <div className="rw-breadcrumb"><span>{roleLabel}</span><span className="rw-crumb-sep">›</span><strong>{nav.find(n => isActive(n.href))?.label ?? "Ready For Work"}</strong></div>
          <div className="rw-topbar-right">
            {identity
              ? <><span className={`rw-role-badge rw-role-${identity.role}`}>{roleLabel}</span><Link className="rw-user-circle" href="/profile" aria-label="Open my profile">{initials}</Link></>
              : <><Link href="/login">Log in</Link><Link href="/signup" className="button rw-compact-button">Get started</Link></>}
          </div>
        </header>
        <main className="rw-content" id="main-content">{children}</main>
        <footer className="rw-footer">Ready For Work · AI-assisted scores are provisional. Integrity signals are private review cues, not proof of misconduct.</footer>
      </div>
    </div>
  );
}
