

// Ticket card:
//     Left colour stripe: gradient for ACTIVE, grey for USED/CANCELLED.
//     Shows: Ticket #id, seat number, event name, venue, date, status badge.
//   
//   GET /api/tickets/:id/qr
//     Response: { qrImageBase64: "data:image/png;base64,..." }
//     Sets the base64 string as the src of an <img> in the modal.
//     Shows the raw QR code string below the image for scanner use.
//   
//   Download button:
//     <a href="/api/tickets/:id/qr/download" download>
//     Points directly to the backend. Browser saves it as ticket-N-qr.png.



import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyTickets, getTicketQR, cancelTicket } from '../api';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusStyle = { ACTIVE: 'badge-green', USED: 'badge-gray', CANCELLED: 'badge-red' };

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(null); // { ticketId, imgSrc }
  const [qrLoading, setQrLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getMyTickets().then(r => { setTickets(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const openQR = async (ticket) => {
    setQrLoading(true);
    setQrModal({ ticketId: ticket.id, imgSrc: null, ticket });
    try {
      const res = await getTicketQR(ticket.id);
      setQrModal({ ticketId: ticket.id, imgSrc: res.data.qrImageBase64, ticket });
    } catch {
      setQrModal(null);
    } finally {
      setQrLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this ticket? This action cannot be undone.')) return;
    try {
      await cancelTicket(id);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'CANCELLED' } : t));
      setMsg('Ticket cancelled.');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Cancel failed.');
    }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">My Tickets</h1>
        <p className="page-sub">Your QR code tickets for upcoming events</p>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      {tickets.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎫</div>
          <div className="empty-title">No tickets yet</div>
          <p style={{ marginBottom: 20 }}>Book an event to get your QR tickets</p>
          <Link to="/events" className="btn btn-primary">Browse Events</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tickets.map(t => (
            <div className="ticket-card" key={t.id}>
              <div className="ticket-card-stripe" style={{ background: t.status === 'ACTIVE' ? 'linear-gradient(to bottom,var(--primary),var(--accent))' : 'var(--border)' }} />
              <div className="ticket-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div className="ticket-id">TICKET #{t.id} · {t.seatNumber}</div>
                  <div className="ticket-event">{t.event?.title || `Event #${t.eventId}`}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
                    {t.event?.venue && <span>📍 {t.event.venue} · </span>}
                    {t.event?.eventDate && <span>📅 {formatDate(t.event.eventDate)}</span>}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`badge ${statusStyle[t.status] || 'badge-gray'}`}>{t.status}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {t.status === 'ACTIVE' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => openQR(t)}>
                        View QR
                      </button>
                      <a
                        href={`http://localhost:3000/api/tickets/${t.id}/qr/download`}
                        className="btn btn-secondary btn-sm"
                        download
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => {
                          const token = localStorage.getItem('token');
                          if (!token) { e.preventDefault(); return; }
                        }}
                      >
                        ↓ Download
                      </a>
                      <button className="btn btn-danger btn-sm" onClick={() => handleCancel(t.id)}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Your QR Code</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 4 }}>
                {qrModal.ticket.event?.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Seat: {qrModal.ticket.seatNumber} · Ticket #{qrModal.ticketId}
              </div>
            </div>
            {qrLoading ? (
              <div className="loader"><div className="spinner" /></div>
            ) : qrModal.imgSrc ? (
              <div className="qr-img" style={{ margin: '0 auto 20px' }}>
                <img src={qrModal.imgSrc} alt="QR Code" style={{ width: 220, height: 220 }} />
              </div>
            ) : (
              <div className="alert alert-error">Failed to load QR code.</div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, wordBreak: 'break-all' }}>
              {qrModal.ticket.qrCode}
            </div>
            <div className="alert alert-info" style={{ fontSize: 12.5, textAlign: 'left', marginBottom: 16 }}>
              Show this QR code to the organizer at the venue entrance.
            </div>
            <button className="btn btn-secondary" onClick={() => setQrModal(null)} style={{ width: '100%', justifyContent: 'center' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
