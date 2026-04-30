import React from 'react';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 80, fontWeight: 700, color: 'var(--border)', lineHeight: 1 }}>404</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: 'var(--white)', margin: '16px 0 8px' }}>Page not found</div>
        <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn btn-primary">Go Home</Link>
      </div>
    </div>
  );
}
