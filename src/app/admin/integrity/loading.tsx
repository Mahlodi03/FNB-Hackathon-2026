/** Visible while the existing, protected integrity review page loads. No data access. */
export default function Loading() {
  return (
    <section style={{maxWidth:950,margin:"34px auto",display:"grid",gap:18}} role="status" aria-label="Loading integrity reviews">
      <div className="rw-page-heading">
        <span className="eyebrow">Administration</span>
        <h1 className="h2">Private integrity review</h1>
        <p className="muted">Loading recorded assessment signals…</p>
      </div>
      <div className="card" style={{minHeight:120,background:"#f9fbff"}} aria-hidden="true" />
      <div className="card" style={{minHeight:160,background:"#f9fbff"}} aria-hidden="true" />
      <div className="card" style={{minHeight:110,background:"#f9fbff"}} aria-hidden="true" />
    </section>
  );
}
