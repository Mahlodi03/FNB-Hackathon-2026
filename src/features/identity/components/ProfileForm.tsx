"use client";

import { useActionState, useState, useTransition } from "react";
import { setSubmissionSharingAction, signOutAction, updateProfileAction, type FormState } from "../actions";
import type { OwnProfile } from "../mappers";

const idle: FormState = { status: "idle" };

function FieldError({ state, name }: { state: FormState; name: string }) {
  const message = state.fieldErrors?.[name];
  return message ? <span role="alert" style={{ color: "#b32e48", fontWeight: 500 }}>{message}</span> : null;
}

export function ProfileForm({ profile }: { profile: OwnProfile }) {
  const [state, action, pending] = useActionState(updateProfileAction, idle);
  const isStudent = profile.role === "student";
  return (
    <form action={action} style={{ display: "grid", gap: 16 }} noValidate>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        <label>
          Full name
          <input className="input" name="fullName" defaultValue={profile.fullName} required maxLength={160} />
          <FieldError state={state} name="fullName" />
        </label>
        <label>
          Username
          <input className="input" name="username" defaultValue={profile.username} required maxLength={30} autoCapitalize="none" />
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            {isStudent ? `Your public link: /students/${profile.username}` : "Letters, numbers, hyphens or underscores."}
          </span>
          <FieldError state={state} name="username" />
        </label>
        <label>
          {isStudent ? "Institution" : "Company"}
          <input className="input" name="institution" defaultValue={profile.institution ?? ""} maxLength={160} />
          <FieldError state={state} name="institution" />
        </label>
        <label>
          {isStudent ? "Field of interest" : "Hiring for"}
          <input
            className="input"
            name="fieldOfInterest"
            defaultValue={profile.fieldOfInterest ?? ""}
            maxLength={120}
            placeholder={isStudent ? "e.g. Software Engineering" : "e.g. Junior developers"}
          />
          <FieldError state={state} name="fieldOfInterest" />
        </label>
      </div>
      <label>
        Bio
        <textarea name="bio" rows={4} defaultValue={profile.bio ?? ""} maxLength={1000} />
        <FieldError state={state} name="bio" />
      </label>
      <label>
        Profile photo link (optional)
        <input className="input" name="avatarUrl" type="url" defaultValue={profile.avatarUrl ?? ""} placeholder="https://…" maxLength={500} />
        <FieldError state={state} name="avatarUrl" />
      </label>
      {isStudent ? (
        <label style={{ display: "flex", gap: 10, alignItems: "start", fontWeight: 500 }}>
          <input type="checkbox" name="isPublic" defaultChecked={profile.isPublic} style={{ marginTop: 3 }} />
          <span>
            <strong>Make my profile public.</strong>
            <span className="muted" style={{ display: "block", marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>
              Employers and visitors can find you in search and see your passed results. Failed attempts and integrity
              warnings are never shown.
            </span>
          </span>
        </label>
      ) : (
        <input type="hidden" name="isPublic" value="" />
      )}
      {state.message ? (
        <p role={state.status === "success" ? "status" : "alert"} style={{ color: state.status === "success" ? "#118963" : "#b32e48" }}>
          {state.message}
        </p>
      ) : null}
      <div>
        <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </div>
    </form>
  );
}

export function ShareToggle({ attemptId, initialShared }: { attemptId: string; initialShared: boolean }) {
  const [shared, setShared] = useState(initialShared);
  const [message, setMessage] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 500 }}>
        <input
          type="checkbox"
          checked={shared}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.checked;
            startTransition(async () => {
              const result = await setSubmissionSharingAction(attemptId, next);
              setMessage(result);
              if (result.status === "success") setShared(next);
            });
          }}
        />
        Let employers see my full answers and feedback
      </label>
      {message?.message ? (
        <span role={message.status === "success" ? "status" : "alert"} style={{ fontSize: 12, color: message.status === "success" ? "#118963" : "#b32e48" }}>
          {message.message}
        </span>
      ) : null}
    </div>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button className="button secondary" type="submit">Log out</button>
    </form>
  );
}
