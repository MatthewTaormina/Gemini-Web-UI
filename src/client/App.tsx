import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login.js';
import Register from './components/Register.js';
import Home from './components/Home.js';
import Setup from './components/Setup.js';
import UserManagement from './components/UserManagement.js';
import { MainLayout, DashboardLayout } from './components/Layouts.js';
import './App.css';

function App() {
  const [health, setHealth] = useState<string>('Loading...');
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [user, setUser] = useState<string | null>(localStorage.getItem('user'));
  const [isRoot, setIsRoot] = useState<boolean>(localStorage.getItem('isRoot') === 'true');
  const [permissions, setPermissions] = useState<string[]>(JSON.parse(localStorage.getItem('permissions') || '[]'));
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    // Check backend health
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch('/api/health', { headers })
      .then(res => res.json())
      .then(data => setHealth(data.status))
      .catch(() => setHealth('Error connecting to backend'));

    // Check if setup is needed
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => setInitialized(data.initialized))
      .catch(() => setInitialized(false));
  }, [token]);

  const handleLogin = (username: string, isRootUser: boolean, userPermissions: string[], userToken: string) => {
    setUser(username);
    setIsRoot(isRootUser);
    setPermissions(userPermissions);
    setToken(userToken);
    localStorage.setItem('user', username);
    localStorage.setItem('isRoot', isRootUser.toString());
    localStorage.setItem('permissions', JSON.stringify(userPermissions));
    localStorage.setItem('token', userToken);
  };

  const handleLogout = () => {
    setUser(null);
    setIsRoot(false);
    setPermissions([]);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('isRoot');
    localStorage.removeItem('permissions');
    localStorage.removeItem('token');
  };

  if (initialized === null) {
    return <div className="container">Loading system...</div>;
  }

  const hasDashboardAccess = isRoot || permissions.includes('read:dashboard');

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/setup" 
            element={initialized ? <Navigate to="/login" /> : <Setup />} 
          />
          
          {/* Main Site Routes */}
          <Route element={<MainLayout username={user} onLogout={handleLogout} _isRoot={isRoot} hasDashboardAccess={hasDashboardAccess} />}>
            <Route 
              path="/" 
              element={
                !initialized ? (
                  <Navigate to="/setup" />
                ) : (
                  user ? (
                    <Home username={user} isRoot={isRoot} permissions={permissions} token={token} onLogout={handleLogout} health={health} />
                  ) : (
                    <Navigate to="/login" />
                  )
                )
              } 
            />
            <Route 
              path="/login" 
              element={!initialized ? <Navigate to="/setup" /> : (user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />)} 
            />
            <Route 
              path="/register" 
              element={!initialized ? <Navigate to="/setup" /> : (user ? <Navigate to="/" /> : <Register />)} 
            />
          </Route>

          {/* Dashboard Routes */}
          {user && hasDashboardAccess && (
            <Route path="/dashboard" element={<DashboardLayout username={user} _isRoot={isRoot} onLogout={handleLogout} />}>
              <Route index element={<div><h1>Dashboard Overview</h1><p>Welcome to the admin area.</p></div>} />
              <Route path="users" element={<UserManagement token={token} currentPermissions={permissions} isRoot={isRoot} />} />
              <Route path="settings" element={<div><h1>System Settings</h1><p>Configure global parameters.</p></div>} />
            </Route>
          )}

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
