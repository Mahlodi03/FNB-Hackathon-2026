import Link from "next/link";

type Task = {
  id: string;
  slug: string;
  title: string;
  concept: string;
  difficulty: string;
  duration_seconds: number;
  pass_mark: number;
};

async function getTasks(concept?: string, difficulty?: string) {
  const params = new URLSearchParams();
  if (concept) params.set("concept", concept);
  if (difficulty) params.set("difficulty", difficulty);

  const res = await fetch(`http://localhost:3000/api/tasks?${params}`, {
    cache: "no-store",
  });
  const data = await res.json();
  return data.tasks as Task[];
}

export default async function Tasks({searchParams}:{searchParams:Promise<{concept?:string;difficulty?:string}>}) {
  const query = await searchParams;
  const allTasks = await getTasks();
  const concepts = [...new Set(allTasks.map(t => t.concept))].sort();
  const filtered = allTasks.filter(t =>
    (!query.concept || t.concept === query.concept) &&
    (!query.difficulty || t.difficulty === query.difficulty)
  );

  return <section style={{paddingTop:42}}>
   <div className="eyebrow">Practice assessments</div><h1 className="h2" style={{margin:"10px 0"}}>Task library</h1>
   <p className="muted" style={{marginBottom:26}}>10 fictional starter tasks show the agreed schema. Real submissions and grading are delegated to the feature branches.</p>
   <form style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:25}}>
    <select aria-label="Concept" name="concept" defaultValue={query.concept??""} style={{maxWidth:230}}><option value="">All concepts</option>{concepts.map(x=><option key={x} value={x}>{x}</option>)}</select>
    <select aria-label="Difficulty" name="difficulty" defaultValue={query.difficulty??""} style={{maxWidth:190}}><option value="">All difficulties</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
    <button className="button" type="submit">Filter tasks</button><Link href="/tasks" className="button secondary">Clear</Link>
   </form><div className="grid-cards">{filtered.map(t=><article className="card" key={t.id}>
    <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><span className="tag">{t.concept}</span><span className="pill">{t.difficulty}</span></div>
    <h2 style={{fontSize:21,fontWeight:800,margin:"18px 0 9px"}}>{t.title}</h2><p className="muted" style={{fontSize:13,marginBottom:20}}>{t.duration_seconds/60} min • Pass mark {t.pass_mark}% • Three sections</p>
    <Link href={`/tasks/${t.slug}`} className="button secondary">See task</Link>
   </article>)}</div>{!filtered.length&&<p>No tasks match your filters.</p>}
  </section>;
}