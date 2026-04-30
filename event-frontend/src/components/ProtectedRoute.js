import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loader"><div className="spinner" /></div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    return (
      <div className="page" style={{ paddingTop: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: 'var(--white)', marginBottom: 8 }}>Access Denied</div>
        <p style={{ color: 'var(--text-dim)' }}>This page requires {role.toLowerCase()} access.</p>
      </div>
    );
  }

  return children;
}
