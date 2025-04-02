import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // We will create this component next

// Create the root element for React
const rootElement = document.createElement('div');
rootElement.id = 'root';
document.body.appendChild(rootElement);

// Render the App component
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 