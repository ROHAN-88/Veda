import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { useProject } from '../hooks/useProjects';
import { useViewportStore } from '../store/viewportStore';

/**
 * A project's whiteboard. Loading the project reuses the backend's owner-scoped
 * `GET /projects/:id`, so a project that does not exist OR is not owned by the
 * caller resolves to the same "not found" state — no existence leak (IDOR-safe).
 */
export function WhiteboardPage() {
  const { id } = useParams<{ id: string }>();
  const reset = useViewportStore((state) => state.reset);
  const query = useProject(id);

  // Start each project's board at the origin / 100% (the store persists across routes).
  useEffect(() => {
    reset();
  }, [id, reset]);

  if (!id) {
    return <NotFound reason="This project could not be found." />;
  }

  if (query.isLoading) {
    return <div className="screen center muted">Loading…</div>;
  }

  if (query.isError) {
    const status = query.error instanceof ApiError ? query.error.status : 0;
    if (status === 404 || status === 400) {
      return <NotFound reason="This project does not exist or you do not have access to it." />;
    }
    return <NotFound title="Something went wrong" reason="Could not load this project." />;
  }

  return (
    <>
      <div className="whiteboard-topbar">
        <Link to="/" className="whiteboard-back">
          ← Projects
        </Link>
        <span className="whiteboard-title">{query.data?.name}</span>
      </div>
      <WhiteboardCanvas projectId={id} />
    </>
  );
}

function NotFound({ title = 'Project not found', reason }: { title?: string; reason: string }) {
  return (
    <div className="screen center">
      <div className="card">
        <h1>{title}</h1>
        <p className="muted">{reason}</p>
        <p>
          <Link to="/">← Back to projects</Link>
        </p>
      </div>
    </div>
  );
}
