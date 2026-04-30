import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEvents } from '../api';
import { useAuth } from '../AuthContext';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatPrice(p) {
  const n = parseFloat(p);
  return n === 0 ? 'Free' : `PKR ${n.toLocaleString()}`;
}

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    getEvents({ take: 6 }).then(r => {
      const d = r.data;
      setEvents(Array.isArray(d) ? d.slice(0, 6) : (d.events || []).slice(0, 6));
    }).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(108,142,240,0.18), transparent 65%), linear-gradient(180deg,#0d1020,var(--bg))',
        padding: '80px 24px 70px',
        textAlign: 'center',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }} className="fade-up">
          <div style={{ display: 'inline-block', background: 'var(--primary-dim)', border: '1px solid rgba(108,142,240,0.3)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', padding: '5px 16px', borderRadius: 20, marginBottom: 20 }}>
            Event Ticketing Platform
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(32px, 6vw, 58px)', fontWeight: 700, color: 'var(--white)', lineHeight: 1.1, letterSpacing: -1, marginBottom: 20 }}>
            Discover and Book<br />
            <span style={{ color: 'var(--primary)' }}>Unforgettable Events</span>
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 17, marginBottom: 32, lineHeight: 1.7 }}>
            From tech conferences to cultural festivals — find events, book tickets instantly, and get your QR code in seconds.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/events" className="btn btn-primary btn-lg">Browse Events →</Link>
            {!user && <Link to="/register" className="btn btn-ghost btn-lg">Create Account</Link>}
            {user?.role === 'ORGANIZER' && <Link to="/organizer/events/new" className="btn btn-accent btn-lg">Create Event</Link>}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 20, marginBottom: 60 }}>
          {[
            { icon: '🎫', title: 'Instant Booking', desc: 'Reserve seats in seconds with real-time availability checking.' },
            { icon: '📱', title: 'QR Tickets', desc: 'Unique QR code generated immediately after booking confirmation.' },
            { icon: '🔍', title: 'Smart Search', desc: 'Filter events by keyword, venue, or date range.' },
            { icon: '📊', title: 'Organizer Tools', desc: 'Create events, track attendance, and view revenue dashboards.' },
          ].map(f => (
            <div className="card" key={f.title} style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: 'var(--white)', marginBottom: 8 }}>{f.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Upcoming events preview */}
        {events.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>Upcoming Events</h2>
              <Link to="/events" className="btn btn-ghost btn-sm">View all →</Link>
            </div>
            <div className="events-grid">
              {events.map(ev => (
                <Link to={`/events/${ev.id}`} className="event-card" key={ev.id}>
                  <div className="event-card-banner">
                    {ev.bannerUrl ? <img src={ev.bannerUrl} alt={ev.title} /> : <span style={{ fontSize: 36 }}>🎫</span>}
                  </div>
                  <div className="event-card-body">
                    <div className="event-card-title">{ev.title}</div>
                    <div className="event-card-meta">
                      <div className="event-card-meta-row">📅 {formatDate(ev.eventDate)}</div>
                      <div className="event-card-meta-row">📍 {ev.venue}</div>
                    </div>
                  </div>
                  <div className="event-card-footer">
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatPrice(ev.ticketPrice)}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{ev.availableSeats} left</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
