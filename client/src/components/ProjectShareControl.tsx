import { useState } from 'react';
import { errorMessage } from '../api/client';
import { shareUrl } from '../api/share';
import { useCreateShare, useRevokeShare, useShareStatus } from '../hooks/useShare';

/**
 * Inline per-project sharing control. Collapsed, it's a single "Share" button;
 * expanded, it lazily loads the share status and lets the owner create, copy,
 * regenerate, or turn off a read-only public link. The raw token is held only in
 * component memory (shown once), matching the server's show-once contract — a
 * revisit with sharing already on shows "Regenerate link" instead of a stale URL.
 */
export function ProjectShareControl({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const status = useShareStatus(projectId, { enabled: open });
  const createShare = useCreateShare(projectId);
  const revokeShare = useRevokeShare(projectId);

  const active = status.data?.active ?? false;

  const onCreate = (): void =>
    createShare.mutate(undefined, {
      onSuccess: (res) => {
        setToken(res.token);
        setCopied(false);
      },
    });

  const onRevoke = (): void => revokeShare.mutate(undefined, { onSuccess: () => setToken(null) });

  const onCopy = (): void => {
    if (!token) {
      return;
    }
    navigator.clipboard
      .writeText(shareUrl(token))
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        Share
      </button>
    );
  }

  const err = createShare.error ?? revokeShare.error ?? status.error;

  return (
    <div className="share-control" data-no-pan>
      {status.isLoading && <span className="muted">…</span>}
      {token ? (
        <>
          <input
            className="share-url"
            readOnly
            value={shareUrl(token)}
            aria-label="Share link"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button className="ghost" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="ghost danger" onClick={onRevoke} disabled={revokeShare.isPending}>
            Turn off
          </button>
        </>
      ) : active ? (
        <>
          <span className="muted">Sharing is on</span>
          <button className="ghost" onClick={onCreate} disabled={createShare.isPending}>
            Regenerate link
          </button>
          <button className="ghost danger" onClick={onRevoke} disabled={revokeShare.isPending}>
            Turn off
          </button>
        </>
      ) : (
        !status.isLoading && (
          <button onClick={onCreate} disabled={createShare.isPending}>
            Create link
          </button>
        )
      )}
      <button className="ghost" onClick={() => setOpen(false)} aria-label="Close sharing">
        ×
      </button>
      {err && <span className="error">{errorMessage(err)}</span>}
    </div>
  );
}
