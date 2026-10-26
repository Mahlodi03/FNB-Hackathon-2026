"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signInWithGoogleAction, signUpAction, type FormState } from "../actions";

const idle: FormState = { status: "idle" };

function FieldError({ state, name }: { state: FormState; name: string }) {
  const message = state.fieldErrors?.[name];
  return message ? <span role="alert" style={{ color: "#b32e48", fontWeight: 500 }}>{message}</span> : null;
}

function StatusMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const ok = state.status === "success";
  return (
    <p role={ok ? "status" : "alert"} style={{ color: ok ? "#118963" : "#b32e48", fontSize: 14, lineHeight: 1.5 }}>
      {state.message}
    </p>
  );
}

/** Brand mark only; the existing OAuth action and account roles are unchanged. */
function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.28 5.48-4.83 7.18l7.73 6C44.36 38.01 46.98 31.82 46.98 24.55z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.49 14.49 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleButton({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithGoogleAction, idle);
  return (
    <form action={action} style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="next" value={next} />
      <button className="button secondary" type="submit" disabled={pending}>
        <GoogleMark />{pending ? "Redirecting…" : "Continue with Google"}
      </button>
      <StatusMessage state={state} />
    </form>
  );
}

function Divider() {
  return (
    <div className="muted" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />or<span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

export function LoginForm({ next, callbackError }: { next: string; callbackError: boolean }) {
  const [state, action, pending] = useActionState(signInAction, idle);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {callbackError ? <p role="alert" style={{ color: "#b32e48" }}>That sign-in link didn&apos;t work or has expired. Please try again.</p> : null}
      <GoogleButton next={next} />
      <Divider />
      <form action={action} style={{ display: "grid", gap: 16 }} noValidate>
        <input type="hidden" name="next" value={next} />
        <label>
          Email
          <input className="input" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <FieldError state={state} name="email" />
        </label>
        <label>
          Password
          <input className="input" name="password" type="password" autoComplete="current-password" required />
          <FieldError state={state} name="password" />
        </label>
        <StatusMessage state={state} />
        <button className="button" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="muted">New here? <Link style={{ color: "#663bd0" }} href="/signup">Create an account</Link></p>
    </div>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, idle);
  if (state.status === "success") {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <StatusMessage state={state} />
        <Link className="button secondary" href="/login">Go to log in</Link>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <GoogleButton next="/profile" />
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Google sign-up creates a student account. Employers should register with email below.
      </p>
      <Divider />
      <form action={action} style={{ display: "grid", gap: 16 }} noValidate>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 700, color: "#394763", marginBottom: 8 }}>I am signing up as</legend>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label className="pill" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 14px" }}>
              <input type="radio" name="role" value="student" defaultChecked /> A student
            </label>
            <label className="pill" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 14px" }}>
              <input type="radio" name="role" value="employer" /> An employer
            </label>
          </div>
          <FieldError state={state} name="role" />
        </fieldset>
        <label>
          Full name
          <input className="input" name="fullName" autoComplete="name" required maxLength={160} />
          <FieldError state={state} name="fullName" />
        </label>
        <label>
          Email
          <input className="input" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <FieldError state={state} name="email" />
        </label>
        <label>
          Password
          <input className="input" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>At least 8 characters.</span>
          <FieldError state={state} name="password" />
        </label>
        <StatusMessage state={state} />
        <button className="button" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="muted">Already registered? <Link style={{ color: "#663bd0" }} href="/login">Log in</Link></p>
    </div>
  );
}
