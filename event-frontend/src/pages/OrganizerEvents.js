/**
 * OrganizerEvents.js — Member 2: Haseeb Ahmed
 *
 * Organizer event management table at /organizer/events (Workflow 2).
 *
 * On mount: calls getMyEvents() → GET /api/events/my
 *   Returns only events created by the logged-in organizer.
 *
 * handlePublish(id):
 *   Calls publishEvent(id) → POST /api/events/:id/publish
 *   Updates status to 'PUBLISHED' in local state (no full reload).
 *
 * handleDelete(id, title):
 *   Confirms with window.confirm() first.
 *   Calls deleteEvent(id) → DELETE /api/events/:id
 *   Updates status to 'CANCELLED' in local state.
 *
 * Each table row shows: title, date, venue, price, seats, status badge,
 * and action buttons: Stats | Edit | Publish | View | Cancel
 * (buttons shown/hidden based on current status).
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyEvents, publishEvent, deleteEvent } from '../api';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatPrice(p) {
  const n = parseFloat(p);
  return n === 0 ? 'Free' : `PKR ${n.toLocaleString()}`;
}

const statusColor = { PUBLISHED: 'badge-green', DRAFT: 'badge-yellow', CANCELLED: 'badge-red', COMPLETED: 'badge-gray' };

export default function OrganizerEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: 'info' });

  useEffect(() => {
    getMyEvents().then(r => { setEvents(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handlePublish = async (id) => {
    try {
      await publishEvent(id);
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'PUBLISHED' } : e));
      setMsg({ text: 'Event published successfully!', type: 'success' });
    } catch (err) {
      setMsg({ text: err.response?.data?.error || 'Publish failed.', type: 'error' });
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Cancel event "${title}"? This cannot be undone.`)) return;
    try {
      await deleteEvent(id);
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'CANCELLED' } : e));
      setMsg({ text: 'Event cancelled.', type: 'info' });
    } catch (err) {
      setMsg({ text: err.response?.data?.error || 'Delete failed.', type: 'error' });
    }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">My Events</h1>
          <p className="page-sub">Create and manage your events</p>
        </div>
        <Link to="/organizer/events/new" className="btn btn-accent btn-lg">+ Create Event</Link>
      </div>

      {msg.text && (
        <div className={`alert alert-${msg.text ? msg.type : 'info'}`} style={{ marginBottom: 20 }}>
          {msg.text}
        </div>
      )}

      {events.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎪</div>
          <div className="empty-title">No events yet</div>
          <p style={{ marginBottom: 20 }}>Create your first event to get started</p>
          <Link to="/organizer/events/new" className="btn btn-accent">Create Event</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Price</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--white)' }}>{ev.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>#{ev.id}</div>
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{formatDate(ev.eventDate)}</td>
                  <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{ev.venue}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatPrice(ev.ticketPrice)}</td>
                  <td>
                    <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                      {ev.availableSeats}/{ev.totalSeats}
                    </span>
                  </td>
                  <td><span className={`badge ${statusColor[ev.status] || 'badge-gray'}`}>{ev.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Link to={`/organizer/events/${ev.id}/dashboard`} className="btn btn-secondary btn-sm">Stats</Link>
                      <Link to={`/organizer/events/${ev.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                      {ev.status === 'DRAFT' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handlePublish(ev.id)}>Publish</button>
                      )}
                      {ev.status === 'PUBLISHED' && (
                        <Link to={`/events/${ev.id}`} className="btn btn-ghost btn-sm" target="_blank">View</Link>
                      )}
                      {(ev.status === 'DRAFT' || ev.status === 'PUBLISHED') && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ev.id, ev.title)}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
