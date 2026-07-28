import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { transferApi } from '../api/transfer';
import type { Project } from '../api/types';
import { ProjectShareControl } from '../components/ProjectShareControl';
import { downloadJson } from '../features/transfer/download';
import { exportFilename } from '../features/transfer/filename';
import { parseImportFile } from '../features/transfer/parseImportFile';
import { useLogout, useMe } from '../hooks/useAuth';
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useRenameProject,
} from '../hooks/useProjects';
import { useImportProject } from '../hooks/useTransfer';

export function ProjectsPage() {
  const { data: user } = useMe();
  const projects = useProjects();
  const create = useCreateProject();
  const rename = useRenameProject();
  const remove = useDeleteProject();
  const importProject = useImportProject();
  const logout = useLogout();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCreate = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    create.mutate(trimmed, { onSuccess: () => setName('') });
  };

  const onRename = (id: string, current: string): void => {
    const next = window.prompt('Rename project', current)?.trim();
    if (next && next !== current) {
      rename.mutate({ id, name: next });
    }
  };

  const onDelete = (id: string, projectName: string): void => {
    if (window.confirm(`Delete "${projectName}"? This cannot be undone.`)) {
      remove.mutate(id);
    }
  };

  const onExport = (project: Project): void => {
    setTransferError(null);
    transferApi
      .export(project.id)
      .then((doc) => downloadJson(exportFilename(project.name), doc))
      .catch((err) => setTransferError(errorMessage(err)));
  };

  const onImportFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ''; // let the same file be picked again later
    if (!file) {
      return;
    }
    setTransferError(null);
    file
      .text()
      .then((text) => {
        const doc = parseImportFile(text); // throws ImportParseError on a bad file
        importProject.mutate(doc, {
          onSuccess: (project) => navigate(`/projects/${project.id}`),
          onError: (err) => setTransferError(errorMessage(err)),
        });
      })
      .catch((err) => setTransferError(errorMessage(err)));
  };

  const onLogout = (): void => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login') });
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1>Projects</h1>
        <div className="topbar-right">
          <span className="muted">{user?.email}</span>
          <button className="ghost" onClick={onLogout} disabled={logout.isPending}>
            Log out
          </button>
        </div>
      </header>

      <form className="row" onSubmit={onCreate}>
        <input
          placeholder="New project name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={create.isPending || !name.trim()}>
          Create
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={onImportFile}
        />
        <button
          type="button"
          className="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={importProject.isPending}
        >
          Import
        </button>
      </form>
      {create.isError && <p className="error">{errorMessage(create.error)}</p>}
      {transferError && <p className="error">{transferError}</p>}

      {projects.isLoading && <p className="muted">Loading…</p>}
      {projects.isError && <p className="error">{errorMessage(projects.error)}</p>}
      {projects.data?.length === 0 && (
        <p className="muted">No projects yet. Create your first one.</p>
      )}

      <ul className="list">
        {projects.data?.map((project) => (
          <li key={project.id} className="list-item">
            <Link to={`/projects/${project.id}`} className="grow">
              {project.name}
            </Link>
            <ProjectShareControl projectId={project.id} />
            <button className="ghost" onClick={() => onExport(project)}>
              Export
            </button>
            <button className="ghost" onClick={() => onRename(project.id, project.name)}>
              Rename
            </button>
            <button className="ghost danger" onClick={() => onDelete(project.id, project.name)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
