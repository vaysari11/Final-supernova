import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("Supernova: Bootstrapping application...");

const container = document.getElementById('root');

if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("Supernova: Core mounted.");
} else {
  console.error("Supernova: Root container not found.");
}