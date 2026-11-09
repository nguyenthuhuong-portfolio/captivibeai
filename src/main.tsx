import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { AdminDashboard } from './pages/AdminDashboard'
import { AppErrorBoundary } from './components/ErrorBoundary'
import { LanguageProvider } from './hooks/useLanguage'
import './index.css'

const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
      {/* Inside the language provider so the fallback can be translated, around the app so a crash
          inside any panel still leaves a readable screen behind. */}
      <AppErrorBoundary>
        {isAdminRoute ? <AdminDashboard /> : <App />}
      </AppErrorBoundary>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
)
