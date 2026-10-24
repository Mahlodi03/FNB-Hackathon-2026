"use client";
import { useState, useEffect, useCallback } from "react";

const CONCEPTS = ["OOP", "Algorithms", "SQL", "Data Structures", "Data Science"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

type Task = {
  id: string;
  slug: string;
  title: string;
  concept: string;
  difficulty: string;
  status: string;
  duration_seconds: number;
  pass_mark: number;
};

export default function AdminTasks() {
  // --- Create form state ---
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [concept, setConcept] = useState(CONCEPTS[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0]);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [theoryPrompt, setTheoryPrompt] = useState("");
  const [practicalPrompt, setPracticalPrompt] = useState("");
  const [understandingGuidance, setUnderstandingGuidance] = useState("Ask about a concrete choice or edge case in the student's own response.");
  const [theoryWeight, setTheoryWeight] = useState(30);
  const [practicalWeight, setPracticalWeight] = useState(50);
  const [understandingWeight, setUnderstandingWeight] = useState(20);
  const [passMark, setPassMark] = useState(70);
  const [skills, setSkills] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const weightsValid = theoryWeight + practicalWeight + understandingWeight === 100;

  // --- Task list state ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setListError(null);
    try {
      const res = await fetch("/api/tasks?admin=1", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setListError(data.error ?? "Could not load tasks");
        return;
      }
      setTasks(data.tasks);
    } catch {
      setListError("Network error while loading tasks");
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount pattern
    loadTasks();
  }, [loadTasks]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!weightsValid) {
      setError("Rubric weights must sum to 100");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, title, concept, difficulty,
          durationSeconds: durationMinutes * 60,
          theoryPrompt, practicalPrompt, understandingGuidance,
          rubric: {
            theoryWeight, practicalWeight, understandingWeight,
            theoryCriteria: ["Correctly explains the concept", "Uses appropriate technical terms"],
            practicalCriteria: ["Approach plausibly addresses requirements", "Handles important edge cases", "Code is readable"],
            understandingCriteria: ["Explains a specific decision in the own submitted solution", "Considers a realistic counterexample"],
          },
          passMark,
          skills: skills.split(",").map(s => s.trim()).filter(Boolean),
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Validation failed, check your inputs");
        return;
      }
      setSuccess(`Task "${data.task.title}" created successfully`);
      setSlug(""); setTitle(""); setTheoryPrompt(""); setPracticalPrompt(""); setSkills("");
      loadTasks();
    } catch {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(taskId: string) {
    setActionError(null);
    setActionTaskId(taskId);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(typeof data.error === "string" ? data.error : "Could not archive task");
        return;
      }
      loadTasks();
    } catch {
      setActionError("Network error while archiving");
    } finally {
      setActionTaskId(null);
    }
  }

  async function handleTogglePublish(task: Task) {
    setActionError(null);
    setActionTaskId(task.id);
    try {
      const newStatus = task.status === "published" ? "draft" : "published";
      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(typeof data.error === "string" ? data.error : "Could not update task");
        return;
      }
      loadTasks();
    } catch {
      setActionError("Network error while updating");
    } finally {
      setActionTaskId(null);
    }
  }

  return (
    <section style={{ paddingTop: 42, maxWidth: 820, display: "grid", gap: 40 }}>
      <div>
        <div className="eyebrow">Person 2 feature</div>
        <h1 className="h2" style={{ margin: "10px 0 20px" }}>Task administration</h1>
        <p className="muted" style={{ marginBottom: 24 }}>Create a new task. Requires admin sign-in (enforced server-side).</p>

        <form onSubmit={handleSubmit} className="card" style={{ display: "grid", gap: 16 }}>
          <label>Slug (e.g. &quot;oop-inheritance&quot;)
            <input value={slug} onChange={e => setSlug(e.target.value)} required />
          </label>
          <label>Title
            <input value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ flex: 1 }}>Concept
              <select value={concept} onChange={e => setConcept(e.target.value)}>
                {CONCEPTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>Difficulty
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>Duration (minutes)
              <input type="number" min={5} max={240} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} />
            </label>
          </div>
          <label>Theory prompt
            <textarea rows={3} value={theoryPrompt} onChange={e => setTheoryPrompt(e.target.value)} required />
          </label>
          <label>Practical prompt
            <textarea rows={3} value={practicalPrompt} onChange={e => setPracticalPrompt(e.target.value)} required />
          </label>
          <label>Understanding guidance
            <textarea rows={2} value={understandingGuidance} onChange={e => setUnderstandingGuidance(e.target.value)} required />
          </label>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <label style={{ flex: 1 }}>Theory weight %
              <input type="number" min={0} max={100} value={theoryWeight} onChange={e => setTheoryWeight(Number(e.target.value))} />
            </label>
            <label style={{ flex: 1 }}>Practical weight %
              <input type="number" min={0} max={100} value={practicalWeight} onChange={e => setPracticalWeight(Number(e.target.value))} />
            </label>
            <label style={{ flex: 1 }}>Understanding weight %
              <input type="number" min={0} max={100} value={understandingWeight} onChange={e => setUnderstandingWeight(Number(e.target.value))} />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 13, color: weightsValid ? undefined : "#ef4444" }}>
            Total: {theoryWeight + practicalWeight + understandingWeight}% {weightsValid ? "✓" : "(must equal 100)"}
          </p>
          <label>Pass mark %
            <input type="number" min={1} max={100} value={passMark} onChange={e => setPassMark(Number(e.target.value))} />
          </label>
          <label>Skills (comma-separated)
            <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="OOP, Problem solving" />
          </label>
          <label>Status
            <select value={status} onChange={e => setStatus(e.target.value as "draft" | "published")}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create task"}
          </button>
          {error && <p style={{ color: "#ef4444" }}>{error}</p>}
          {success && <p style={{ color: "#22c55e" }}>{success}</p>}
        </form>
      </div>

      <div>
        <h2 className="h2" style={{ fontSize: 22, marginBottom: 16 }}>Existing tasks</h2>
        {loadingTasks && <p className="muted">Loading tasks...</p>}
        {listError && <p style={{ color: "#ef4444" }}>{listError}</p>}
        {actionError && <p style={{ color: "#ef4444" }}>{actionError}</p>}
        {!loadingTasks && tasks.length === 0 && !listError && <p className="muted">No tasks found.</p>}

        <div style={{ display: "grid", gap: 10 }}>
          {tasks.map(t => (
            <div key={t.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>{t.title}</p>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t.concept} · {t.difficulty} · {t.status} · pass mark {t.pass_mark}%</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="button secondary" type="button" disabled={actionTaskId === t.id} onClick={() => handleTogglePublish(t)}>
                  {actionTaskId === t.id ? "..." : t.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button className="button secondary" type="button" disabled={actionTaskId === t.id} onClick={() => handleArchive(t.id)}>
                  {actionTaskId === t.id ? "..." : "Archive"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}