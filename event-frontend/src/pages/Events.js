import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getEvents } from '../api';

function statusBadge(status) {
  const map = { PUBLISHED: 'badge-green', DRAFT: 'badge-yellow', CANCELLED: 'badge-red', COMPLETED: 'badge-gray' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPrice(p) {
  const n = parseFloat(p);
  return n === 0 ? 'Free' : `PKR ${n.toLocaleString()}`;
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [venue, setVenue] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (venue) params.venue = venue;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await getEvents(params);
      const data = res.data;

      // UPDATED HANDLING
      if (Array.isArray(data)) {
        setEvents(data);
      } else if (data.results) {
        setEvents(data.results);
      } else {
        setEvents([]);
      }

    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [search, venue, from, to]);

  useEffect(() => {
    const t = setTimeout(fetchEvents, 350);
    return () => clearTimeout(t);
  }, [fetchEvents]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Discover Events</h1>
        <p className="page-sub">Find and book your next experience</p>
      </div>

      <div className="search-bar" style={{ gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label className="form-label">Search</label>
          <input className="form-input" placeholder="Search by title or keyword…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="form-label">Venue</label>
          <input className="form-input" placeholder="e.g. Karachi" value={venue} onChange={e => setVenue(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label className="form-label">From</label>
          <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label className="form-label">To</label>
          <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {(search || venue || from || to) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setVenue(''); setFrom(''); setTo(''); }} style={{ alignSelf: 'flex-end' }}>
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : events.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎪</div>
          <div className="empty-title">No events found</div>
          <p>Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((ev, i) => (
            <Link to={`/events/${ev.id}`} className="event-card fade-up" key={ev.id} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="event-card-banner">
                {ev.bannerUrl
                  ? <img src={ev.bannerUrl} alt={ev.title} />
                  : <span style={{ fontSize: 36 }}>🎫</span>}
              </div>
              <div className="event-card-body">
                <div className="event-card-title">{ev.title}</div>
                <div className="event-card-meta">
                  <div className="event-card-meta-row">📅 {formatDate(ev.eventDate)}</div>
                  <div className="event-card-meta-row">📍 {ev.venue}</div>
                </div>
              </div>
              <div className="event-card-footer">
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>
                  {formatPrice(ev.ticketPrice)}
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                  {ev.availableSeats} seats left
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}