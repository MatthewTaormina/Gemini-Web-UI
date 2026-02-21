import React, { useState, useEffect, useCallback } from 'react';

interface Setting {
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

const SettingsManagement: React.FC<{ token: string | null; checkPermission: (a: string, r: string) => boolean; _isRoot: boolean }> = ({ token, checkPermission }) => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('{}');
  const [editValue, setEditValue] = useState('');

  const canRead = checkPermission('read', 'settings');
  const canUpdate = checkPermission('update', 'settings');
  const canManage = checkPermission('manage', 'settings');

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setError('Failed to load settings');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (canRead) fetchSettings();
  }, [fetchSettings, canRead]);

  const handleCreateSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedValue;
      try {
        parsedValue = JSON.parse(newValue);
      } catch (e) {
        alert('Invalid JSON value');
        return;
      }

      const response = await fetch(`/api/settings/path/${newKey}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ value: parsedValue })
      });

      if (response.ok) {
        setShowCreateForm(false);
        setNewKey('');
        setNewValue('{}');
        fetchSettings();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create setting');
      }
    } catch {
      alert('Connection error');
    }
  };

  const handleUpdateSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetting) return;

    try {
      let parsedValue;
      try {
        parsedValue = JSON.parse(editValue);
      } catch (e) {
        alert('Invalid JSON value');
        return;
      }

      const response = await fetch(`/api/settings/path/${editingSetting.key}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ value: parsedValue })
      });

      if (response.ok) {
        setEditingSetting(null);
        fetchSettings();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update setting');
      }
    } catch {
      alert('Connection error');
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Are you sure you want to delete the setting '${key}'?`)) return;
    try {
      const response = await fetch(`/api/settings/path/${key}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchSettings();
      } else {
        alert('Failed to delete setting');
      }
    } catch {
      alert('Failed to delete setting');
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Settings Management</h1>
        {(canUpdate || canManage) && (
          <button className="btn" style={{ width: 'auto' }} onClick={() => setShowCreateForm(true)}>+ New Setting</button>
        )}
      </div>

      {showCreateForm && (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3>Create New Setting</h3>
          <form onSubmit={handleCreateSetting}>
            <div className="form-group">
              <label>Key (ltree format, e.g., global.app.chat)</label>
              <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)} required placeholder="global.app.myapp" />
            </div>
            <div className="form-group">
              <label>Value (JSON)</label>
              <textarea 
                style={{ width: '100%', minHeight: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'monospace' }}
                value={newValue} 
                onChange={e => setNewValue(e.target.value)} 
                required 
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn" style={{ width: 'auto' }}>Create</button>
              <button type="button" className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editingSetting && (
        <div className="modal-overlay" onClick={() => setEditingSetting(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Edit Setting: {editingSetting.key}</h3>
              <button className="modal-close" onClick={() => setEditingSetting(null)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateSetting}>
              <div className="form-group">
                <label>Value (JSON)</label>
                <textarea 
                  style={{ width: '100%', minHeight: '200px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'monospace' }}
                  value={editValue} 
                  onChange={e => setEditValue(e.target.value)} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" className="btn" style={{ width: 'auto' }}>Save Changes</button>
                <button type="button" className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={() => setEditingSetting(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead style={{ backgroundColor: '#f8f9fa' }}>
          <tr>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Key</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Value</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Last Updated</th>
            <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #eee' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {settings.map(s => (
            <tr key={s.key}>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', fontWeight: 'bold', verticalAlign: 'top' }}>
                {s.key}
              </td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                <pre style={{ margin: 0, fontSize: '0.85rem', backgroundColor: '#f1f3f5', padding: '0.5rem', borderRadius: '4px', maxHeight: '150px', overflow: 'auto' }}>
                  {JSON.stringify(s.value, null, 2)}
                </pre>
              </td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', fontSize: '0.9rem', verticalAlign: 'top' }}>
                {new Date(s.updated_at).toLocaleString()}
              </td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', textAlign: 'right', verticalAlign: 'top' }}>
                {canUpdate && (
                  <button 
                    onClick={() => {
                      setEditingSetting(s);
                      setEditValue(JSON.stringify(s.value, null, 2));
                    }} 
                    style={{ color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', marginRight: '10px' }}
                  >
                    Edit
                  </button>
                )}
                {canManage && (
                  <button onClick={() => handleDelete(s.key)} style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SettingsManagement;
