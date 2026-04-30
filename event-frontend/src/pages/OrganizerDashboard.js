

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEventDashboard, getEventAttendance, getEventAttendanceSummary, publishEvent } from '../api';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OrganizerDashboard() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = () => {
    Promise.all([
      getEventDashboard(id),
      getEventAttendance(id),
      getEventAttendanceSummary(id),
    ]).then(([d, a, s]) => {
      setData(d.data);
      setAttendees(a.data);
      setSummary(s.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handlePublish = async () => {
    try {
      await publishEvent(id);
      setMsg('Event published!');
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed.');
    }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!data) return <div className="page"><div className="alert alert-error">Event not found or access denied.</div></div>;

  const { event, stats } = data;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Link to="/organizer/events" style={{ color: 'var(--text-dim)', fontSize: 14, textDecoration: 'none' }}>← My Events</Link>
          </div>
          <h1 className="page-title">{event.title}</h1>
          <p className="page-sub">Event Dashboard · Live Stats</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {event.status === 'DRAFT' && (
            <button className="btn btn-accent" onClick={handlePublish}>Publish Event</button>
          )}
          <Link to={`/organizer/events/${id}/edit`} className="btn btn-secondary">Edit</Link>
          <Link to={`/events/${id}`} className="btn btn-ghost" target="_blank">View Public</Link>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))' }}>
        <div className="stat-card primary">
          <div className="stat-value">{stats.ticketsSold}</div>
          <div className="stat-label">Tickets Sold</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-value">PKR {(stats.totalRevenue || 0).toLocaleString()}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.attendedCount}</div>
          <div className="stat-label">Attended</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.notYetArrived}</div>
          <div className="stat-label">Not Arrived Yet</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.fillRatePct}%</div>
          <div className="stat-label">Fill Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.seatsRemaining}</div>
          <div className="stat-label">Seats Remaining</div>
        </div>
      </div>

      {/* Fill Rate Bar */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Capacity Fill Rate</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{stats.fillRatePct}%</span>
        </div>
        <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ width: `${stats.fillRatePct}%`, height: '100%', background: 'linear-gradient(to right, var(--primary), var(--accent))', transition: 'width 0.8s ease', borderRadius: 10 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
          <span>{stats.ticketsSold} sold</span>
          <span>{event.totalSeats} total</span>
        </div>
      </div>

      {/* Scan summary */}
      {summary && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="section-title" style={{ fontSize: 16, marginBottom: 12 }}>Scan Activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--success)', fontFamily: "'Fraunces',serif" }}>{summary.attended || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Present</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--warning)', fontFamily: "'Fraunces',serif" }}>{summary.duplicateAttemptsBlocked || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Duplicate Scans Blocked</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--error)', fontFamily: "'Fraunces',serif" }}>{summary.invalidAttempts || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Invalid Attempts</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', fontFamily: "'Fraunces',serif" }}>{summary.totalScanAttempts || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Total Scans</div>
            </div>
          </div>
        </div>
      )}

      {/* Attendees Table */}
      <div className="section-title">Confirmed Attendees ({attendees.length})</div>
      {attendees.length === 0 ? (
        <div className="empty" style={{ padding: '30px 0' }}>
          <p>No attendees scanned in yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Seat</th>
                <th>Scanned At</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a, i) => (
                <tr key={a.id}>
                  <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{a.ticket?.user?.name || '—'}</td>
                  <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{a.ticket?.user?.email || '—'}</td>
                  <td><span className="badge badge-blue">{a.ticket?.seatNumber || '—'}</span></td>
                  <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{formatDate(a.scanTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
