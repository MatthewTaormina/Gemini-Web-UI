import React, { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  username: string;
  is_root: boolean;
  enabled: boolean;
  created_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
}

const UserManagement: React.FC<{ token: string | null; currentPermissions: string[]; isRoot: boolean }> = ({ token, currentPermissions, isRoot }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canCreate = isRoot || currentPermissions.includes('create:users');
  const canDelete = isRoot || currentPermissions.includes('delete:users');
  const canRestore = isRoot || currentPermissions.includes('restore:users');
  const canResetPassword = isRoot || currentPermissions.includes('reset_password:users');

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
          <button className="btn" style={{ width: 'auto' }}>+ Create User</button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead style={{ backgroundColor: '#f8f9fa' }}>
          <tr>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Username</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Status</th>
            <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }}>Created</th>
            <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid #eee' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} style={{ opacity: user.deleted_at ? 0.6 : 1 }}>
              <td style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
                {user.username} {user.is_root && <span style={{ fontSize: '0.7rem', backgroundColor: '#ffd700', padding: '2px 4px', borderRadius: '3px', marginLeft: '5px' }}>ROOT</span>}
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
                        {canResetPassword && <button style={{ color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', marginRight: '10px' }}>Reset PW</button>}
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
