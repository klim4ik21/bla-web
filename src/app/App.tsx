import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Layout } from '../components/Layout'
import { AuthLayout } from '../pages/auth/AuthLayout'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { UsernamePage } from '../pages/auth/UsernamePage'
import './app.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore()

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#252525] border-t-[#e5e5e5] rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  if (!user.username) {
    return <Navigate to="/auth/username" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitialized } = useAuthStore()

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#252525] border-t-[#e5e5e5] rounded-full animate-spin" />
      </div>
    )
  }

  if (user && user.username) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
  },
  {
    path: '/conversations/:conversationId',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
  },
  {
    path: '/auth',
    element: (
      <PublicRoute>
        <AuthLayout />
      </PublicRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  {
    path: '/auth/username',
    element: <UsernamePage />,
  },
])

export function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return <RouterProvider router={router} />
}
