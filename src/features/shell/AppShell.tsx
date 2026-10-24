"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight, BookOpen, BriefcaseBusiness, ClipboardCheck, Files,
  GraduationCap, Home, LayoutDashboard, LogIn, ShieldCheck, UserRound,
  UsersRound, type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Role = "student" | "employer" | "admin";
type NavItem = { href: string; label: string; icon: LucideIcon };

const studentNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Challenges", icon: BookOpen },
  { href: "/progress", label: "My Progress", icon: ClipboardCheck },
  { href: "/evidence", label: "My Evidence", icon: Files },
  { href: "/profile", label: "Profile", icon: UserRound },
];
const employerNavigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Candidate Search", icon: UsersRound },
  { href: "/profile", label: "My Profile", icon: BriefcaseBusiness },
];
const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tasks", label: "Tasks", icon: BookOpen },
  { href: "/admin/integrity", label: "Flagged Attempts", icon: ShieldCheck },
  { href: "/profile", label: "Profile", icon: UserRound },
];
const publicNavigation: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Challenges", icon: BookOpen },
  { href: "/students", label: "Students", icon: UsersRound },
];

function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link className={`rw-logo ${small ? "rw-logo-small" : ""}`} href="/" aria-label="Ready For Work home">
      <span className="rw-logo-emblem"><GraduationCap size={small ? 17 : 21} strokeWidth={2.7} /></span>
      <span className="rw-logo-words">READY<span>FOR</span>WORK<span className="rw-logo-dot">.</span></span>
    </Link>
  );
}

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
        <Logo />
        <nav aria-label="Main navigation" className="rw-public-links">
          <Link href="/tasks">Challenges</Link><Link href="/students">Student profiles</Link>
          <Link className="rw-nav-login" href="/login">Log in <ArrowRight size={15} /></Link>
        </nav>
      </header>
      <main id="main-content" className="rw-public-main">{children}</main>
    </div>
  );
  return (
    <div className="rw-app">
      <aside className="rw-sidebar" aria-label="Sidebar">
        <div className="rw-sidebar-brand"><Logo /></div>
        <div className="rw-user-block">
          <span className="rw-avatar" aria-hidden="true">{initials}</span>
          <div><strong>{identity?.name ?? "Ready For Work"}</strong><small>{identity ? `${roleLabel} workspace` : "Explore the platform"}</small></div>
        </div>
        <span className="rw-nav-label">WORKSPACE</span>
        <nav className="rw-side-links" aria-label="Workspace navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link className={`rw-side-link ${isActive(href) ? "active" : ""}`} href={href} key={href} aria-current={isActive(href) ? "page" : undefined}>
              <Icon size={17} strokeWidth={2} /> {label}
            </Link>
          ))}
          {!identity && <Link className={`rw-side-link ${pathname === "/login" ? "active" : ""}`} href="/login"><LogIn size={17}/>Log in</Link>}
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
            {identity ? <><span className={`rw-role-badge rw-role-${identity.role}`}>{roleLabel}</span><Link className="rw-user-circle" href="/profile" aria-label="Open my profile">{initials}</Link></> : <><Link href="/login">Log in</Link><Link href="/signup" className="button rw-compact-button">Sign up</Link></>}
          </div>
        </header>
        <main className="rw-content" id="main-content">{children}</main>
        <footer className="rw-footer">Ready For Work · AI-assisted scores are provisional; integrity events are reviewed privately and are not proof of misconduct.</footer>
      </div>
    </div>
  );
}
