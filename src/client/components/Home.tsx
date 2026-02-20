import React from 'react';

interface HomeProps {
  username: string;
  isRoot: boolean;
  permissions: string[];
  token: string | null;
  onLogout: () => void;
  health: string;
}

const Home: React.FC<HomeProps> = ({ username, isRoot, permissions, token, onLogout, health }) => {
  return (
    <div className="container">
      <div className="auth-card" style={{ maxWidth: '600px' }}>
        <h2>Welcome, {username}!</h2>
        {isRoot && (
          <div style={{ 
            display: 'inline-block', 
            padding: '0.25rem 0.5rem', 
            backgroundColor: '#ffd700', 
            borderRadius: '4px', 
            fontSize: '0.8rem', 
            fontWeight: 'bold',
            marginBottom: '1rem' 
          }}>
            ROOT ADMINISTRATOR
          </div>
        )}
        <p style={{ textAlign: 'center', color: '#28a745', fontWeight: 'bold' }}>
          Securely logged in with JWT {token ? `(Session: ${token.substring(0, 8)}...)` : ''}
        </p>
        
        {!isRoot && permissions.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <strong>Your Permissions:</strong>
            <ul style={{ fontSize: '0.9rem', color: '#555' }}>
              {permissions.map(p => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}

        <div style={{ margin: '2rem 0', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
          <strong>System Status:</strong> {health}
        </div>
        <button onClick={onLogout} className="btn" style={{ backgroundColor: '#dc3545' }}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Home;
