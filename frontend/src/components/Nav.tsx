import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav className="nav">
      <span className="nav-brand">EchoGPT</span>
      <NavLink to="/chat">Chat</NavLink>
      <NavLink to="/providers">Providers</NavLink>
      <NavLink to="/settings">Settings</NavLink>
      <span className="nav-spacer" />
      <span className="nav-user">{user?.email}</span>
      <button type="button" className="btn-link" onClick={logout}>
        Logout
      </button>
    </nav>
  );
}
