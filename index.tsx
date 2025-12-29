
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');

if (container) {
  try {
    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Critical Runtime Error:", err);
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: #666; font-family: sans-serif;">
        <h1 style="color: #f59e0b; font-size: 1.5rem;">System Failure</h1>
        <pre style="background: #111; padding: 20px; border-radius: 8px; font-size: 11px; color: #f87171; margin-top: 20px;">${err instanceof Error ? err.message : 'Unknown Error'}</pre>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; border: 1px solid #333; background: transparent; color: #eee; cursor: pointer;">Retry Connection</button>
      </div>
    `;
  }
}