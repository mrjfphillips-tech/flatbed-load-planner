import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppRouter } from './router'
import { useAppStore } from './store'
import './index.css'

// Set up online/offline event listeners for the app store
function setupConnectivityListeners() {
  const setOnline = useAppStore.getState().setOnline;
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
}

setupConnectivityListeners();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
)
