import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="screen center">
      <div className="card">
        <h1>404</h1>
        <p className="muted">Page not found.</p>
        <Link to="/">Go home</Link>
      </div>
    </div>
  );
}
