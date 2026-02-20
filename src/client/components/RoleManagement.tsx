import React, { useState, useEffect, useCallback } from 'react';

interface Permission {
  id: string;
  name: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: { id: string; name: string }[];
}

const RoleManagement: React.FC<{ token: string | null; checkPermission: (a: string, r: string) => boolean; _isRoot: boolean }> = ({ token, checkPermission }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  
  // Modal state for attaching permissions
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);

  // New/Edit role form state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const activeRoleForPerms = roles.find(r => r.id === activeRoleId);

  const canRead = checkPermission('read', 'roles');
  const canCreate = checkPermission('create', 'roles');
  const canUpdate = checkPermission('update', 'roles');

  const fetchData = useCallback(async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/admin/roles', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/permissions', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (rolesRes.ok && permsRes.ok) {
        setRoles(await rolesRes.json());
        setAllPermissions(await permsRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch roles/perms', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (canRead) fetchData();
  }, [fetchData, canRead]);

  const handleCreateOrUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!editingRoleId;
    const url = isEdit ? `/api/admin/roles/${editingRoleId}` : '/api/admin/roles';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          name: newRoleName, 
          description: newRoleDesc, 
          permissionIds: selectedPerms 
        })
      });

      if (response.ok) {
        resetForm();
        fetchData();
      } else {
        alert(`Failed to ${isEdit ? 'update' : 'create'} role`);
      }
    } catch {
      alert('Error connecting to server');
    }
  };

  const handleSyncPermissions = async (roleId: string, permissionIds: string[]) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          name: role.name, 
          description: role.description, 
          permissionIds 
        })
      });

      if (response.ok) {
        fetchData();
      } else {
        alert('Failed to update permissions');
      }
    } catch {
      alert('Connection error');
    }
  };

  const detachPermission = (roleId: string, permId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    const currentPermIds = role.permissions.map(p => p.id);
    const updatedPermIds = currentPermIds.filter(id => id !== permId);
    handleSyncPermissions(roleId, updatedPermIds);
  };

  const attachPermission = (roleId: string, permId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;
    const currentPermIds = role.permissions.map(p => p.id);
    if (currentPermIds.includes(permId)) return;
    handleSyncPermissions(roleId, [...currentPermIds, permId]);
  };

  const startEdit = (role: Role) => {
    setEditingRoleId(role.id);
    setNewRoleName(role.name);
    setNewRoleDesc(role.description);
    setSelectedPerms(role.permissions.map(p => p.id));
    setShowCreateForm(true);
    window.scrollTo(0,0);
  };

  const resetForm = () => {
    setEditingRoleId(null);
    setNewRoleName('');
    setNewRoleDesc('');
    setSelectedPerms([]);
    setShowCreateForm(false);
  };

  const togglePermissionInCreate = (id: string) => {
    setSelectedPerms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (!canRead) return <div>Access Denied</div>;
  if (loading) return <div>Loading roles...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Role Management</h1>
        {canCreate && (
          <button className="btn" style={{ width: 'auto' }} onClick={() => setShowCreateForm(true)}>+ Create Role</button>
        )}
      </div>

      {showCreateForm && (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3>{editingRoleId ? 'Edit Role' : 'Create New Role'}</h3>
          <form onSubmit={handleCreateOrUpdateRole}>
            <div className="form-group">
              <label>Role Name</label>
              <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} />
            </div>
            {!editingRoleId && (
              <div className="form-group">
                <label>Initial Permissions</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', padding: '0.5rem', borderRadius: '4px' }}>
                  {allPermissions.map(perm => (
                    <label key={perm.id} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedPerms.includes(perm.id)} 
                        onChange={() => togglePermissionInCreate(perm.id)}
                        style={{ marginRight: '5px' }}
                      />
                      {perm.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" style={{ width: 'auto' }}>{editingRoleId ? 'Update Role' : 'Create Role'}</button>
              <button type="button" className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {activeRoleForPerms && (
        <div className="modal-overlay" onClick={() => setActiveRoleId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Attach Permissions to {activeRoleForPerms.name}</h3>
              <button className="modal-close" onClick={() => setActiveRoleId(null)}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allPermissions
                .filter(p => !activeRoleForPerms.permissions.some(rp => rp.id === p.id))
                .map(perm => (
                  <div key={perm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{perm.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>{perm.description}</div>
                    </div>
                    <button 
                      className="btn" 
                      style={{ width: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => attachPermission(activeRoleForPerms.id, perm.id)}
                    >
                      Attach
                    </button>
                  </div>
                ))}
              {allPermissions.filter(p => !activeRoleForPerms.permissions.some(rp => rp.id === p.id)).length === 0 && (
                <p style={{ textAlign: 'center', color: '#666' }}>All available permissions are already attached.</p>
              )}
            </div>
            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button className="btn" style={{ width: 'auto', backgroundColor: '#6c757d' }} onClick={() => setActiveRoleId(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {roles.map(role => (
          <div key={role.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1a73e8' }}>{role.name}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {canUpdate && (
                  <>
                    <button 
                      onClick={() => setActiveRoleId(role.id)} 
                      style={{ color: '#28a745', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Attach Perms
                    </button>
                    <button 
                      onClick={() => startEdit(role)} 
                      style={{ color: '#1a73e8', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Edit Info
                    </button>
                  </>
                )}
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>{role.description}</p>
            <div>
              <strong>Permissions:</strong>
              <div className="badge-container">
                {role.permissions.map(p => (
                  <span key={p.id} className="badge">
                    {p.name}
                    {canUpdate && (
                      <button className="badge-remove" onClick={() => detachPermission(role.id, p.id)}>&times;</button>
                    )}
                  </span>
                ))}
                {role.permissions.length === 0 && <span style={{ fontSize: '0.8rem', color: '#999' }}>No permissions assigned</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoleManagement;
