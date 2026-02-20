import React, { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  username: string;
  is_root: boolean;
  enabled: boolean;
  created_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
  roles?: { id: string, name: string }[];
}

const UserManagement: React.FC<{ token: string | null; checkPermission: (a: string, r: string) => boolean; _isRoot: boolean }> = ({ token, checkPermission }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState<string | null>(null); // user id
  
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [allRoles, setAllRoles] = useState<{ id: string, name: string }[]>([]);

  const activeUserForRoles = users.find(u => u.id === activeUserId);

  const canCreate = checkPermission('create', 'users');
  const canDelete = checkPermission('delete', 'users');
  const canRestore = checkPermission('update', 'users');
  const canResetPassword = checkPermission('reset_password', 'users');
  const canManageRoles = checkPermission('update', 'users');

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Failed to load users');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setAllRoles(await response.json());
      }
    } catch (err) {
      console.error('Failed to fetch roles', err);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
    if (canManageRoles) fetchRoles();
  }, [fetchUsers, fetchRoles, canManageRoles]);

  const handleSyncRoles = async (userId: string, roleIds: string[]) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ roleIds })
      });
      if (response.ok) {
        fetchUsers();
      } else {
        alert('Failed to update roles');
      }
    } catch {
      alert('Connection error');
    }
  };

  const detachRole = (userId: string, roleId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.roles) return;
    const updatedIds = user.roles.filter(r => r.id !== roleId).map(r => r.id);
    handleSyncRoles(userId, updatedIds);
  };

  const attachRole = (userId: string, roleId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const currentIds = user.roles ? user.roles.map(r => r.id) : [];
    if (currentIds.includes(roleId)) return;
    handleSyncRoles(userId, [...currentIds, roleId]);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      if (response.ok) {
        setShowCreateForm(false);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create user');
      }
    } catch {
      alert('Connection error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/admin/users/${showResetForm}/password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ password: newPassword })
      });
      if (response.ok) {
        setShowResetForm(null);
        setNewPassword('');
        alert('Password updated successfully');
      } else {
        alert('Failed to reset password');
      }
    } catch {
      alert('Connection error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchUsers();
    } catch {
      alert('Failed to delete user');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/users/${id}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) fetchUsers();
    } catch {
      alert('Failed to restore user');
    }
  };

  if (loading) return <div>Loading users...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>User Management</h1>
        {canCreate && (
          <button className="btn" style={{ width: 'auto' }} onClick={() => setShowCreateForm(true)}>+ Create User</button>
        )}
      </div>

      {showCreateForm && (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3>Create New User</h3>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label>Username</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label>Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" style={{ width: 'auto' }}>Save</button>
              <button type="button" className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={() => setShowCreateForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showResetForm && (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3>Reset Password</h3>
          <form onSubmit={handleResetPassword} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" style={{ width: 'auto' }}>Update</button>
              <button type="button" className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={() => setShowResetForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {activeUserForRoles && (
        <div className="modal-overlay" onClick={() => setActiveUserId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Attach Roles to {activeUserForRoles.username}</h3>
              <button className="modal-close" onClick={() => setActiveUserId(null)}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allRoles
                .filter(role => !activeUserForRoles.roles?.some(ur => ur.id === role.id))
                .map(role => (
                  <div key={role.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 'bold' }}>{role.name}</div>
                    <button 
                      className="btn" 
                      style={{ width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => attachRole(activeUserForRoles.id, role.id)}
                    >
                      Attach
                    </button>
                  </div>
                ))}
              {allRoles.filter(role => !activeUserForRoles.roles?.some(ur => ur.id === role.id)).length === 0 && (
                <p style={{ textAlign: 'center', color: '#666' }}>All available roles are already attached.</p>
              )}
            </div>
            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={() => setActiveUserId(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead style={{ backgroundColor: '#f8f9fa' }}>
          <tr>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Username / Roles</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Status</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Created</th>
            <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #eee' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} style={{ opacity: user.deleted_at ? 0.6 : 1 }}>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {user.username} {user.is_root && <span style={{ fontSize: '0.7rem', backgroundColor: '#ffd700', padding: '2px 4px', borderRadius: '3px', marginLeft: '5px' }}>ROOT</span>}
                </div>
                <div className="badge-container">
                  {user.roles?.map(role => (
                    <span key={role.id} className="badge">
                      {role.name}
                      {canManageRoles && <button className="badge-remove" onClick={() => detachRole(user.id, role.id)}>&times;</button>}
                    </span>
                  ))}
                </div>
              </td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
                {user.deleted_at ? <span style={{ color: '#dc3545' }}>Deleted</span> : <span style={{ color: '#28a745' }}>Active</span>}
              </td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', fontSize: '0.9rem' }}>
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                {!user.is_root && (
                  <>
                    {user.deleted_at ? (
                      canRestore && <button onClick={() => handleRestore(user.id)} style={{ color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', marginRight: '10px' }}>Restore</button>
                    ) : (
                      <>
                        {canManageRoles && <button onClick={() => setActiveUserId(user.id)} style={{ color: '#28a745', border: 'none', background: 'none', cursor: 'pointer', marginRight: '10px' }}>Attach Role</button>}
                        {canResetPassword && <button onClick={() => setShowResetForm(user.id)} style={{ color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', marginRight: '10px' }}>Reset PW</button>}
                        {canDelete && <button onClick={() => handleDelete(user.id)} style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>}
                      </>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagement;
