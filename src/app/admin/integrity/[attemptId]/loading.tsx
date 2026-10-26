/** Loading presentation only; actual role checks remain in the existing page. */
export default function Loading() {
  return (
    <section style={{maxWidth:950,margin:"34px auto",display:"grid",gap:17}} role="status" aria-label="Loading assessment review">
      <div className="rw-page-heading">
        <span className="eyebrow">Administration</span>
        <h1 className="h2">Assessment review</h1>
        <p className="muted">Loading the private review details…</p>
      </div>
      <div className="card" style={{minHeight:120,background:"#f9fbff"}} aria-hidden="true" />
      <div className="card" style={{minHeight:170,background:"#f9fbff"}} aria-hidden="true" />
      <div className="card" style={{minHeight:125,background:"#f9fbff"}} aria-hidden="true" />
    </section>
  );
}
