import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Navbar() {
  const { user, authLogout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    authLogout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        Event<span>Hub</span>
      </Link>
      <div className="nav-links" style={{ flexWrap: 'nowrap', gap: 4 }}>
        <Link to="/events" className={isActive('/events')}>Browse</Link>

        {user && user.role === 'ATTENDEE' && (
          <>
            <Link to="/my-bookings" className={isActive('/my-bookings')}>My Bookings</Link>
            <Link to="/my-tickets" className={isActive('/my-tickets')}>My Tickets</Link>
          </>
        )}

        {user && user.role === 'ORGANIZER' && (
          <>
            <Link to="/organizer/events" className={isActive('/organizer/events')}>My Events</Link>
            <Link to="/organizer/scanner" className={isActive('/organizer/scanner')}>Scanner</Link>
          </>
        )}

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
            <span className={`nav-role-badge ${user.role.toLowerCase()}`}>{user.role}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{user.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
