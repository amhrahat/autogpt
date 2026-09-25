import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, errorMessage } from '../api';
import { useAuth } from '../auth';
import Nav from '../components/Nav';

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  async function handleProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    try {
      await apiClient.updateProfile({ name: name || undefined, email });
      await refreshUser();
      setProfileMsg('Profile saved');
    } catch (err) {
      setProfileErr(errorMessage(err));
    }
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');
    try {
      const result = await apiClient.changePassword(currentPassword, newPassword);
      setPasswordMsg(result.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordErr(errorMessage(err));
    }
  }

  async function handleDeleteAccount() {
    if (!confirm('Delete your account and ALL its data? This cannot be undone.')) return;
    try {
      await apiClient.deleteAccount();
      logout();
      navigate('/login');
    } catch (err) {
      alert(errorMessage(err));
    }
  }

  return (
    <>
      <Nav />
      <main className="page narrow">
        <h1>Settings</h1>

        <form className="card" onSubmit={handleProfile}>
          <h2>Profile</h2>
          {profileMsg && <p className="success">{profileMsg}</p>}
          {profileErr && <p className="error">{profileErr}</p>}
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit">Save profile</button>
        </form>

        <form className="card" onSubmit={handlePassword}>
          <h2>Change password</h2>
          <p className="hint">Changing your password logs out all sessions.</p>
          {passwordMsg && <p className="success">{passwordMsg}</p>}
          {passwordErr && <p className="error">{passwordErr}</p>}
          <label>
            Current password
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="min 8 chars, upper+lower+digit"
            />
          </label>
          <button type="submit">Change password</button>
        </form>

        <div className="card">
          <h2>Danger zone</h2>
          <button type="button" className="danger" onClick={handleDeleteAccount}>
            Delete account
          </button>
        </div>
      </main>
    </>
  );
}
