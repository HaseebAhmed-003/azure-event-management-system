
// handleCancel(id):
//     1. Confirms with window.confirm() first
//     2. Sets cancelling state to show loading on that button
//     3. Calls cancelBooking(id) → DELETE /api/bookings/:id
//     4. Optimistic update: immediately maps over bookings array
//        and sets status = 'CANCELLED' for the matching id.
//        This updates the UI without a full page reload.

// Status badge colours:
//     CONFIRMED → green   PENDING → yellow
//     CANCELLED → red     REFUNDED → grey

//  "View Tickets" button appears only on CONFIRMED bookings.
//  "Cancel" button appears only on PENDING or CONFIRMED bookings.


import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyBookings, cancelBooking } from '../api';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatPrice(p) {
  const n = parseFloat(p);
  return n === 0 ? 'Free' : `PKR ${n.toLocaleString()}`;
}

const statusStyle = {
  CONFIRMED: 'badge-green',
  PENDING: 'badge-yellow',
  CANCELLED: 'badge-red',
  REFUNDED: 'badge-gray',
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getMyBookings().then(r => {
      setBookings(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancelling(id);
    try {
      await cancelBooking(id);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
      setMsg('Booking cancelled successfully.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Cancel failed.');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Bookings</h1>
        <p className="page-sub">Track all your event reservations</p>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      {bookings.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No bookings yet</div>
          <p style={{ marginBottom: 20 }}>Browse events and book your first ticket</p>
          <Link to="/events" className="btn btn-primary">Explore Events</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bookings.map(b => (
            <div className="card" key={b.id} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', padding: '20px 24px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, color: 'var(--white)' }}>
                    {b.event?.title || `Event #${b.eventId}`}
                  </span>
                  <span className={`badge ${statusStyle[b.status] || 'badge-gray'}`}>{b.status}</span>
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {b.event?.eventDate && <span>📅 {formatDate(b.event.eventDate)}</span>}
                  {b.event?.venue && <span>📍 {b.event.venue}</span>}
                  <span>🎟️ {b.quantity} ticket{b.quantity > 1 ? 's' : ''}</span>
                  <span>💰 {formatPrice(b.totalAmount)}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Booked {formatDate(b.createdAt)}</span>
                </div>
                {b.tickets && b.tickets.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <span className="badge badge-blue">{b.tickets.length} ticket{b.tickets.length > 1 ? 's' : ''} issued</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                {b.status === 'CONFIRMED' && (
                  <Link to="/my-tickets" className="btn btn-primary btn-sm">View Tickets</Link>
                )}
                {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b.id)} disabled={cancelling === b.id}>
                    {cancelling === b.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
                <Link to={`/events/${b.eventId}`} className="btn btn-ghost btn-sm">View Event</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
