import type { Project } from '../api/types';
import { useSetNotesIncluded } from '../hooks/useProjects';

interface NotesProjectFilterProps {
  projects: Project[];
}

/**
 * Which projects appear in the combined notes view — one toggle chip per project.
 *
 * Lives here rather than on the projects-page rows: those already carry Share,
 * Export, Rename and Delete, and `.list-item` has no `flex-wrap`, so a sixth
 * control would squeeze the project name. Putting it on this page also means you
 * adjust the view while looking at it.
 *
 * The choice is stored on the project, so it follows the user across devices, and
 * the server filters on it — an excluded board's cards are never sent.
 */
export function NotesProjectFilter({ projects }: NotesProjectFilterProps) {
  const { mutate: setIncluded } = useSetNotesIncluded();

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="notes__filter" role="group" aria-label="Projects shown in this view">
      <span className="hint">Show:</span>
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          className="ghost notes__filter-chip"
          aria-pressed={project.notesIncluded}
          onClick={() => setIncluded({ id: project.id, notesIncluded: !project.notesIncluded })}
        >
          {project.name}
        </button>
      ))}
    </div>
  );
}
