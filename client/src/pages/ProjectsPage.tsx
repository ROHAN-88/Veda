import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useLogout, useMe } from '../hooks/useAuth';
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useRenameProject,
} from '../hooks/useProjects';

export function ProjectsPage() {
  const { data: user } = useMe();
  const projects = useProjects();
  const create = useCreateProject();
  const rename = useRenameProject();
  const remove = useDeleteProject();
  const logout = useLogout();
  const navigate = useNavigate();
  const [name, setName] = useState('');

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
      </form>
      {create.isError && <p className="error">{errorMessage(create.error)}</p>}

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
