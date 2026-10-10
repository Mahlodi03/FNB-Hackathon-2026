import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DEMO_MODE } from "@/lib/flags";
export const metadata: Metadata = {
  title: "Ready For Work | Skill evidence, not just claims",
  description: "Show employers practical evidence of your skills. FNB hackathon starter."
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>
    <header className="container nav">
      <Link href="/" className="brand">ready<span>for</span>work.</Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/tasks">Tasks</Link><Link href="/students">Students</Link>
        <Link href="/profile">My profile</Link><Link href="/admin">Admin</Link><Link href="/login">Log in</Link>
      </nav>
    </header>
    {DEMO_MODE && <div className="container" role="status" style={{background:"#173929",border:"1px solid #387158",padding:"10px 14px",borderRadius:10,fontSize:12,color:"#bff4d2",marginBottom:16}}>
      Skeleton / demo data mode: sample people and tasks are fictional. Sign-in, persistence, AI grading, proctoring and verified results are NOT yet connected.
    </div>}
    <main className="container" style={{minHeight:"60vh"}}>{children}</main>
    <footer><div className="container">Ready For Work • FNB Hackathon 2026 • Evidence-assisted skill profiles, not guaranteed proof of identity or independence.</div></footer>
  </body></html>;
}
