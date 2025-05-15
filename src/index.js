import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import Modal from 'react-modal';
import './output.css';



Modal.setAppElement('#root');


const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
      <App />
  </React.StrictMode>
);

reportWebVitals();
