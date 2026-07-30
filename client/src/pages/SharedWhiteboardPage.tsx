import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shareApi } from '../api/share';
import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { cardsKey } from '../hooks/useCards';
import { connectionsKey } from '../hooks/useConnections';
import { useViewportStore } from '../store/viewportStore';

/**
 * The public, unauthenticated view of a shared board (`/share/:token`). It lives
 * OUTSIDE `ProtectedRoute`, so it never redirects to login. It fetches the board
 * from the one public endpoint, seeds the caches the canvas reads from, and renders
 * a read-only `WhiteboardCanvas` — every editing surface is disabled. An unknown or
 * revoked token yields the same "unavailable" screen (no existence leak).
 */
export function SharedWhiteboardPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const reset = useViewportStore((state) => state.reset);

  const query = useQuery({
    queryKey: ['share', token],
    queryFn: () => shareApi.getPublic(token as string),
    enabled: Boolean(token),
    retry: false,
  });

  const board = query.data;
  const projectId = board?.project.id;

  useEffect(() => {
    if (!board) {
      return;
    }
    // Pre-seed the exact caches CardsLayer/ConnectionsLayer read (their queries are
    // disabled in read-only), so nothing hits the owner-scoped endpoints.
    queryClient.setQueryData(cardsKey(board.project.id), board.cards);
    queryClient.setQueryData(connectionsKey(board.project.id), board.connections);
    reset();
  }, [board, queryClient, reset]);

  if (!token || query.isError) {
    return <Unavailable />;
  }
  if (query.isLoading || !board || !projectId) {
    return <div className="screen center muted">Loading…</div>;
  }

  return (
    <>
      <div className="whiteboard-topbar">
        <Link to="/" className="whiteboard-back">
          Second Brain
        </Link>
        <span className="whiteboard-title">{board.project.name}</span>
        <span className="muted">Read-only · shared link</span>
      </div>
      <WhiteboardCanvas projectId={projectId} readOnly />
    </>
  );
}

function Unavailable() {
  return (
    <div className="screen center">
      <div className="card">
        <h1>Board unavailable</h1>
        <p className="muted">This shared link is invalid or has been turned off.</p>
        <p>
          <Link to="/">← Go to Second Brain</Link>
        </p>
      </div>
    </div>
  );
}
