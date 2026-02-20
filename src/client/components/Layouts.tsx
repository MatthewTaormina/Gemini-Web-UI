import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import '../Layouts.css';

export const DashboardLayout: React.FC<{ username: string; _isRoot: boolean; onLogout: () => void }> = ({ username, onLogout }) => {
  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Logout revocation failed:', err);
    }
    onLogout();
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2>Admin Panel</h2>
        <nav>
          <ul>
            <li><Link to="/dashboard">Overview</Link></li>
            <li><Link to="/dashboard/users">Users</Link></li>
            <li><Link to="/dashboard/roles">Roles</Link></li>
            <li><Link to="/dashboard/permissions">Permissions</Link></li>
            <li><Link to="/dashboard/settings">Settings</Link></li>
            <li><Link to="/">Back to Site</Link></li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <p style={{ fontSize: '0.8rem', color: '#a0aec0' }}>Logged in as: {username}</p>
          <button onClick={handleLogout} className="btn" style={{ padding: '0.5rem', fontSize: '0.8rem', backgroundColor: '#e53e3e' }}>
            Logout
          </button>
        </div>
      </aside>
      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
};

export const MainLayout: React.FC<{ username: string | null; onLogout: () => void; _isRoot: boolean; hasDashboardAccess: boolean }> = ({ username, onLogout, hasDashboardAccess }) => {
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Logout revocation failed:', err);
    }
    onLogout();
  };

  return (
    <div className="main-layout">
      <nav className="navbar">
        <Link to="/" style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1a73e8', textDecoration: 'none' }}>
          Gemini UI
        </Link>
        <div className="nav-links">
          {username ? (
            <>
              {hasDashboardAccess && <Link to="/dashboard">Dashboard</Link>}
              <span style={{ marginLeft: '1rem', color: '#718096' }}>{username}</span>
              <button 
                onClick={handleLogout} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#e53e3e', 
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: '1rem',
                  font: 'inherit'
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
};
