import { Link, useParams } from 'react-router-dom';

/** Placeholder — the pannable canvas + spatial index arrive in Phase 3. */
export function WhiteboardPage() {
  const { id } = useParams();
  return (
    <div className="screen">
      <p>
        <Link to="/">← Back to projects</Link>
      </p>
      <div className="card">
        <h1>Whiteboard</h1>
        <p className="muted">
          Project <code>{id}</code> — the pannable canvas + spatial index arrive in Phase 3.
        </p>
      </div>
    </div>
  );
}
