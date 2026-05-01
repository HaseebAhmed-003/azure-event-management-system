import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api';
import { useAuth } from '../AuthContext';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ATTENDEE'
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { authLogin } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Enter a valid email.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await register(form);

      authLogin(res.data.token, res.data.user);

      if (res.data.user.role === 'ORGANIZER') {
        navigate('/organizer/events');
      } else {
        navigate('/events');
      }

    } catch (err) {
      // ✅ FULL DEBUG (IMPORTANT)
      console.log("REGISTER ERROR FULL:", err);
      console.log("SERVER RESPONSE:", err.response?.data);

      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        JSON.stringify(err.response?.data) ||
        err.message ||
        'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 440 }} className="fade-up">

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--white)',
            marginBottom: 8
          }}>
            Create account
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>
            Join EventHub and start discovering events
          </p>
        </div>

        <div className="card">

          {error && (
            <div className="alert alert-error">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                placeholder="Your Name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">Account Type</label>
              <select
                className="form-select"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value })
                }
              >
                <option value="ATTENDEE">
                  Attendee — browse & book events
                </option>
                <option value="ORGANIZER">
                  Organizer — create & manage events
                </option>
              </select>
            </div>

            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                justifyContent: 'center'
              }}
            >
              {loading ? 'Creating account…' : 'Create account →'}
            </button>

          </form>

          <p style={{
            color: 'var(--text-dim)',
            fontSize: 14,
            marginTop: 20,
            textAlign: 'center'
          }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)' }}>
              Sign in →
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}