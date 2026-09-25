import { useEffect, useState, type FormEvent } from 'react';
import { apiClient, errorMessage, type Provider } from '../api';
import Nav from '../components/Nav';

const emptyForm = { name: '', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '', isDefault: false };

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Provider | null>(null); // null = list, object = edit
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [healthStatus, setHealthStatus] = useState<Record<string, string>>({});

  async function load() {
    try {
      setProviders(await apiClient.listProviders());
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(p: Provider) {
    setEditing(p);
    setForm({ name: p.name, type: p.type, baseUrl: p.baseUrl, apiKey: '', model: p.model, isDefault: p.isDefault });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        // only send the apiKey if the user typed a new one
        const data = { ...form, apiKey: form.apiKey || undefined };
        await apiClient.updateProvider(editing.id, data);
      } else {
        await apiClient.createProvider(form);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this provider?')) return;
    try {
      await apiClient.deleteProvider(id);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleTest(id: string) {
    setHealthStatus((s) => ({ ...s, [id]: 'testing…' }));
    try {
      const result = await apiClient.healthCheck(id);
      setHealthStatus((s) => ({ ...s, [id]: result.status + (result.detail ? ` — ${result.detail}` : '') }));
    } catch (err) {
      setHealthStatus((s) => ({ ...s, [id]: `error — ${errorMessage(err)}` }));
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await apiClient.updateProvider(id, { isDefault: true });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleToggleEnabled(p: Provider) {
    try {
      await apiClient.updateProvider(p.id, { isEnabled: !p.isEnabled });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <Nav />
      <main className="page">
        <div className="page-head">
          <h1>AI Providers</h1>
          <button type="button" onClick={startCreate}>Add provider</button>
        </div>
        {error && <p className="error">{error}</p>}

        {showForm && (
          <form className="card" onSubmit={handleSubmit}>
            <h2>{editing ? `Edit ${editing.name}` : 'New provider'}</h2>
            <label>
              Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">Custom (OpenAI-compatible)</option>
              </select>
            </label>
            <label>
              Base URL
              <input required type="url" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
            </label>
            <label>
              Model
              <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="gpt-4o-mini" />
            </label>
            <label>
              API key {editing && <span className="hint">(leave blank to keep the current key)</span>}
              <input
                type="password"
                required={!editing}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={editing ? '••••••••' : 'sk-…'}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Set as default
            </label>
            <div className="row">
              <button type="submit">{editing ? 'Save' : 'Create'}</button>
              <button type="button" className="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {providers.length === 0 && !showForm && (
          <p className="page-note">No providers yet — add one to start chatting.</p>
        )}

        <ul className="list">
          {providers.map((p) => (
            <li key={p.id} className="list-item">
              <div className="list-main">
                <strong>{p.name}</strong>{' '}
                {p.isDefault && <span className="badge">default</span>}
                {!p.isEnabled && <span className="badge muted">disabled</span>}
                <div className="muted small">
                  {p.type} · {p.model} · {p.baseUrl}
                </div>
                {healthStatus[p.id] && <div className="small">{healthStatus[p.id]}</div>}
              </div>
              <div className="row">
                <button type="button" onClick={() => handleTest(p.id)}>Test</button>
                <button type="button" className="secondary" onClick={() => handleToggleEnabled(p)}>
                  {p.isEnabled ? 'Disable' : 'Enable'}
                </button>
                {!p.isDefault && (
                  <button type="button" className="secondary" onClick={() => handleSetDefault(p.id)}>
                    Set default
                  </button>
                )}
                <button type="button" className="secondary" onClick={() => startEdit(p)}>Edit</button>
                <button type="button" className="danger" onClick={() => handleDelete(p.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
