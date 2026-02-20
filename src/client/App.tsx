import React, { useState, useEffect } from 'react';

function App() {
  const [health, setHealth] = useState<string>('Loading...');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data.status))
      .catch(() => setHealth('Error connecting to backend'));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Gemini Web UI</h1>
        <p>Backend Status: {health}</p>
      </header>
    </div>
  );
}

export default App;
