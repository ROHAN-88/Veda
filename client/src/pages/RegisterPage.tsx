import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useLogin, useRegister } from '../hooks/useAuth';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useRegister();
  const login = useLogin();
  const navigate = useNavigate();

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    register.mutate(
      { email, password },
      { onSuccess: () => login.mutate({ email, password }, { onSuccess: () => navigate('/') }) },
    );
  };

  const pending = register.isPending || login.isPending;
  const error = register.error ?? login.error;

  return (
    <div className="screen center">
      <form className="card" onSubmit={onSubmit}>
        <h1>Create account</h1>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className="hint">At least 12 characters.</span>
        </label>
        {error != null && <p className="error">{errorMessage(error)}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted">
          Have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
