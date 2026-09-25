import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate('/chat');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <h1>EchoGPT</h1>
      <form className="card" onSubmit={handleSubmit}>
        <h2>{mode === 'login' ? 'Log in' : 'Register'}</h2>
        {error && <p className="error">{error}</p>}
        {mode === 'register' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'min 8 chars, upper+lower+digit' : 'password'}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <p className="toggle">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button type="button" className="btn-link" onClick={() => setMode('register')}>
                Register
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button type="button" className="btn-link" onClick={() => setMode('login')}>
                Log in
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
