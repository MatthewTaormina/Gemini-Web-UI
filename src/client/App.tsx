import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login.js';
import Register from './components/Register.js';
import Home from './components/Home.js';
import Setup from './components/Setup.js';
import './App.css';

function App() {
  const [health, setHealth] = useState<string>('Loading...');
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [user, setUser] = useState<string | null>(localStorage.getItem('user'));
  const [isRoot, setIsRoot] = useState<boolean>(localStorage.getItem('isRoot') === 'true');

  useEffect(() => {
    // Check backend health
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data.status))
      .catch(() => setHealth('Error connecting to backend'));

    // Check if setup is needed
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => setInitialized(data.initialized))
      .catch(() => setInitialized(false));
  }, []);

  const handleLogin = (username: string, isRootUser: boolean) => {
    setUser(username);
    setIsRoot(isRootUser);
    localStorage.setItem('user', username);
    localStorage.setItem('isRoot', isRootUser.toString());
  };

  const handleLogout = () => {
    setUser(null);
    setIsRoot(false);
    localStorage.removeItem('user');
    localStorage.removeItem('isRoot');
  };

  if (initialized === null) {
    return <div className="container">Loading system...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/setup" 
            element={initialized ? <Navigate to="/login" /> : <Setup />} 
          />
          <Route 
            path="/login" 
            element={!initialized ? <Navigate to="/setup" /> : (user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />)} 
          />
          <Route 
            path="/register" 
            element={!initialized ? <Navigate to="/setup" /> : (user ? <Navigate to="/" /> : <Register />)} 
          />
          <Route 
            path="/" 
            element={
              !initialized ? (
                <Navigate to="/setup" />
              ) : (
                user ? (
                  <Home username={user} isRoot={isRoot} onLogout={handleLogout} health={health} />
                ) : (
                  <Navigate to="/login" />
                )
              )
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
