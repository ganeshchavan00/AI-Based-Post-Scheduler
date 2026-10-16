import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadUser } from './features/auth/authSlice';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Diagnostics from './pages/Diagnostics';
import CreatePost from './pages/CreatePost';
import PostHistory from './pages/PostHistory';
import ScheduledPosts from './pages/ScheduledPosts';
import AIGenerator from './pages/AIGenerator';
import SocialAccounts from './pages/SocialAccounts';

export default function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      dispatch(loadUser());
    }
  }, [dispatch, token]);

  return (
    <div className="min-h-screen bg-[#EFF6FF] text-[#1E293B] flex flex-col font-sans selection:bg-[#2563EB] selection:text-white">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Content View */}
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/diagnostics" element={<Diagnostics />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-post"
            element={
              <ProtectedRoute>
                <CreatePost />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-generator"
            element={
              <ProtectedRoute>
                <AIGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scheduled"
            element={
              <ProtectedRoute>
                <ScheduledPosts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts"
            element={
              <ProtectedRoute>
                <PostHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social-accounts"
            element={
              <ProtectedRoute>
                <SocialAccounts />
              </ProtectedRoute>
            }
          />

          {/* Root Redirect */}
          <Route
            path="/"
            element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
          />

          {/* Catch-all */}
          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
          />
        </Routes>
      </main>

      {/* Professional SaaS Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Social Media Post Scheduler &bull; Social Media Automation Platform</span>
          <span className="text-slate-400">Production SaaS Interface &bull; B.Tech Final Evaluation Ready</span>
        </div>
      </footer>
    </div>
  );
}
