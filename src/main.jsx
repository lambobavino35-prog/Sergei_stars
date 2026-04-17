import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Одноразовая очистка: удаляем старый Service Worker, оставшийся
// от предыдущих версий приложения. Когда-нибудь (когда у всех пользователей
// обновится кэш) этот блок можно будет удалить.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
