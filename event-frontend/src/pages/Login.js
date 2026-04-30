import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { authLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Both fields are required.'); return; }
    setLoading(true);
    try {
      const res = await login(form);
      authLogin(res.data.token, res.data.user);
      const role = res.data.user.role;
      if (role === 'ORGANIZER') navigate('/organizer/events');
      else navigate('/events');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }} className="fade-up">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>Sign in to your EventHub account</p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div className="alert alert-info" style={{ marginBottom: 12, textAlign: 'left', fontSize: 12.5 }}>
              <div>
                <strong>Demo accounts:</strong><br />
                Attendee: attendee@eventsystem.com / attendee123<br />
                Organizer: organizer@eventsystem.com / organizer123
              </div>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
              No account?{' '}
              <Link to="/register" style={{ color: 'var(--primary)' }}>Create one →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
