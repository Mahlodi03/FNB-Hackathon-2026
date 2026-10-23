"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signInWithGoogleAction, signUpAction, type FormState } from "../actions";

const idle: FormState = { status: "idle" };

function FieldError({ state, name }: { state: FormState; name: string }) {
  const message = state.fieldErrors?.[name];
  return message ? <span role="alert" style={{ color: "#ffb4b4", fontWeight: 500 }}>{message}</span> : null;
}

function StatusMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const ok = state.status === "success";
  return (
    <p role={ok ? "status" : "alert"} style={{ color: ok ? "#bff4d2" : "#ffb4b4", fontSize: 14, lineHeight: 1.5 }}>
      {state.message}
    </p>
  );
}

function GoogleButton({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithGoogleAction, idle);
  return (
    <form action={action} style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="next" value={next} />
      <button className="button secondary" type="submit" disabled={pending}>
        {pending ? "Redirecting…" : "Continue with Google"}
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
      {callbackError ? <p role="alert" style={{ color: "#ffb4b4" }}>That sign-in link didn&apos;t work or has expired. Please try again.</p> : null}
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
      <p className="muted">New here? <Link style={{ color: "#79ecc3" }} href="/signup">Create an account</Link></p>
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
          <legend style={{ fontSize: 13, fontWeight: 700, color: "#b8d1db", marginBottom: 8 }}>I am signing up as</legend>
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
      <p className="muted">Already registered? <Link style={{ color: "#79ecc3" }} href="/login">Log in</Link></p>
    </div>
  );
}
