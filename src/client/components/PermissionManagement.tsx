import React, { useState, useEffect, useCallback } from 'react';

interface Permission {
  id: string;
  name: string;
  action: string;
  resource: string;
  description: string;
}

const PermissionManagement: React.FC<{ token: string | null; checkPermission: (a: string, r: string) => boolean; _isRoot: boolean }> = ({ token, checkPermission }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [newAction, setNewAction] = useState('read');
  const [newResource, setNewResource] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const canRead = checkPermission('read', 'roles');
  const canUpdateRoles = checkPermission('update', 'roles');

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setPermissions(await response.json());
      }
    } catch (err) {
      console.error('Failed to fetch permissions', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (canRead) fetchPermissions();
  }, [fetchPermissions, canRead]);

  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = `${newAction}:${newResource}`;
    try {
      const response = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          name, 
          action: newAction, 
          resource: newResource, 
          description: newDesc 
        })
      });

      if (response.ok) {
        setNewAction('read');
        setNewResource('');
        setNewDesc('');
        setShowCreateForm(false);
        fetchPermissions();
      } else {
        alert('Failed to create permission');
      }
    } catch {
      alert('Error connecting to server');
    }
  };

  const handleDeletePermission = async (id: string) => {
    if (!window.confirm('Delete this permission? Roles using it will lose this access.')) return;
    try {
      const response = await fetch(`/api/admin/permissions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchPermissions();
    } catch {
      alert('Failed to delete');
    }
  };

  if (!canRead) return <div>Access Denied</div>;
  if (loading) return <div>Loading permissions...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Permission Management</h1>
        {canUpdateRoles && (
          <button className="btn" style={{ width: 'auto' }} onClick={() => setShowCreateForm(true)}>+ Create Permission</button>
        )}
      </div>

      {showCreateForm && (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3>Create New Permission</h3>
          <form onSubmit={handleCreatePermission}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Action</label>
                <select value={newAction} onChange={e => setNewAction(e.target.value)} style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="create">create</option>
                  <option value="read">read</option>
                  <option value="update">update</option>
                  <option value="delete">delete</option>
                  <option value="reset_password">reset_password</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Resource</label>
                <input type="text" placeholder="e.g. users, roles, settings" value={newResource} onChange={e => setNewResource(e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
            <p style={{ fontSize: '0.8rem', color: '#666' }}>Generated Name: <strong>{newAction}:{newResource}</strong></p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" style={{ width: 'auto' }}>Save Permission</button>
              <button type="button" className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead style={{ backgroundColor: '#f8f9fa' }}>
          <tr>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Name</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Action</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Resource</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Description</th>
            <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #eee' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map(perm => (
            <tr key={perm.id}>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{perm.name}</td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>{perm.action}</td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>{perm.resource}</td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', color: '#666', fontSize: '0.9rem' }}>{perm.description}</td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                {canUpdateRoles && (
                  <button onClick={() => handleDeletePermission(perm.id)} style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PermissionManagement;
