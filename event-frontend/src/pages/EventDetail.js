/**
 * EventDetail.js — Member 2: Haseeb Ahmed
 *
 * Event detail page + booking flow at /events/:id (Workflow 2).
 *
 * Step state machine — 'browse' | 'payment' | 'done':
 *
 *   'browse':
 *     Shows event details, banner, seat count, price.
 *     User picks a quantity (1–10, max available).
 *     "Book Now" → calls createBooking({ eventId, quantity })
 *                   POST /api/bookings
 *                → on success: stores bookingId, moves to 'payment'
 *
 *   'payment':
 *     Shows booking summary + total cost.
 *     "Confirm Payment" → simulatePayment(bookingId, true)
 *                          POST /api/payments/simulate/:bookingId
 *                       → tickets generated, moves to 'done'
 *     "Simulate Failure" → simulatePayment(bookingId, false)
 *                        → booking cancelled, seats restored, back to 'browse'
 *
 *   'done':
 *     Shows success message with ticket count.
 *     "View My Tickets" navigates to /my-tickets.
 *
 * Organizers see a warning instead of the booking widget.
 * Guests see a "Sign in to Book" button instead.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEvent, createBooking, simulatePayment } from '../api';
import { useAuth } from '../AuthContext';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatPrice(p) {
  const n = parseFloat(p);
  return n === 0 ? 'Free' : `PKR ${n.toLocaleString()}`;
}

const STEPS = { browse: 0, confirm: 1, payment: 2, done: 3 };

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('browse');
  const [quantity, setQuantity] = useState(1);
  const [booking, setBooking] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getEvent(id).then(r => { setEvent(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const handleBook = async () => {
    if (!user) { navigate('/login'); return; }
    if (user.role === 'ORGANIZER') { setError('Organizers cannot book tickets.'); return; }
    setError('');
    setProcessing(true);
    try {
      const res = await createBooking({ eventId: parseInt(id), quantity });
      setBooking(res.data);
      setStep('payment');
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePay = async (success) => {
    setError('');
    setProcessing(true);
    try {
      const res = await simulatePayment(booking.id, success);
      if (success) {
        setTickets(res.data.tickets || []);
        setStep('done');
        // Refresh event to update seat count
        getEvent(id).then(r => setEvent(r.data));
      } else {
        setError('Payment failed. Booking cancelled, seats restored.');
        setStep('browse');
        setBooking(null);
        getEvent(id).then(r => setEvent(r.data));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Payment error.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!event) return <div className="page"><div className="alert alert-error">Event not found.</div></div>;

  const price = parseFloat(event.ticketPrice);
  const total = price * quantity;
  const isSoldOut = event.availableSeats === 0;

  return (
    <div className="page">
      {/* Banner */}
      {event.bannerUrl && (
        <div style={{ width: '100%', height: 300, borderRadius: 'var(--radius)', overflow: 'hidden', marginTop: 32, marginBottom: 32 }}>
          <img src={event.bannerUrl} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, marginTop: event.bannerUrl ? 0 : 32, alignItems: 'start' }}>
        {/* Left column */}
        <div>
          <span className={`badge ${isSoldOut ? 'badge-red' : 'badge-green'}`} style={{ marginBottom: 12 }}>
            {isSoldOut ? 'Sold Out' : 'Available'}
          </span>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 700, color: 'var(--white)', lineHeight: 1.2, marginBottom: 16 }}>
            {event.title}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, color: 'var(--text-dim)' }}>
            <div>📅 {formatDate(event.eventDate)}</div>
            <div>📍 {event.venue}</div>
            <div>🎟️ {event.availableSeats} of {event.totalSeats} seats available</div>
            <div>💰 {formatPrice(event.ticketPrice)}</div>
          </div>
          {event.description && (
            <div className="card" style={{ marginTop: 0 }}>
              <div className="section-title" style={{ fontSize: 18, marginBottom: 10 }}>About this event</div>
              <p style={{ color: 'var(--text-dim)', lineHeight: 1.8 }}>{event.description}</p>
            </div>
          )}
        </div>

        {/* Right column — booking widget */}
        <div className="card" style={{ position: 'sticky', top: 80 }}>
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          {step === 'browse' && (
            <>
              <div className="section-title" style={{ fontSize: 18 }}>Book Tickets</div>
              <div style={{ color: 'var(--accent)', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
                {formatPrice(event.ticketPrice)} <span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 400 }}>/ ticket</span>
              </div>
              {!isSoldOut ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Quantity (1–10)</label>
                    <select className="form-select" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))}>
                      {Array.from({ length: Math.min(10, event.availableSeats) }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n} ticket{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                  {price > 0 && (
                    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: 'var(--text-dim)' }}>
                      Total: <strong style={{ color: 'var(--white)' }}>PKR {total.toLocaleString()}</strong>
                    </div>
                  )}
                  {user?.role === 'ATTENDEE' ? (
                    <button className="btn btn-accent btn-lg" onClick={handleBook} disabled={processing} style={{ width: '100%', justifyContent: 'center' }}>
                      {processing ? 'Processing…' : 'Book Now'}
                    </button>
                  ) : user ? (
                    <div className="alert alert-info" style={{ fontSize: 13 }}>Organizers cannot book tickets.</div>
                  ) : (
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')} style={{ width: '100%', justifyContent: 'center' }}>
                      Sign in to Book
                    </button>
                  )}
                </>
              ) : (
                <div className="alert alert-error">This event is sold out.</div>
              )}
            </>
          )}

          {step === 'payment' && booking && (
            <>
              <div className="section-title" style={{ fontSize: 18 }}>Confirm Payment</div>
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 14 }}>
                <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Booking #{booking.id}</div>
                <div><strong style={{ color: 'var(--white)' }}>{quantity} × {event.title}</strong></div>
                <div style={{ marginTop: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>
                  Total: {price > 0 ? `PKR ${total.toLocaleString()}` : 'Free'}
                </div>
              </div>
              <div className="alert alert-info" style={{ fontSize: 12.5, marginBottom: 16 }}>
                This is a simulated payment — no real card needed.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn btn-accent btn-lg" onClick={() => handlePay(true)} disabled={processing} style={{ justifyContent: 'center' }}>
                  {processing ? 'Processing…' : '✓ Confirm Payment'}
                </button>
                <button className="btn btn-danger" onClick={() => handlePay(false)} disabled={processing} style={{ justifyContent: 'center' }}>
                  ✗ Simulate Failure
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setStep('browse'); setBooking(null); }} disabled={processing} style={{ justifyContent: 'center' }}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: 'var(--white)', marginBottom: 8 }}>Booking Confirmed!</div>
              <p style={{ color: 'var(--text-dim)', fontSize: 13.5, marginBottom: 16 }}>
                {tickets.length} QR ticket{tickets.length > 1 ? 's' : ''} generated. Check your tickets below.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => navigate('/my-tickets')} style={{ justifyContent: 'center' }}>
                  View My Tickets
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep('browse')} style={{ justifyContent: 'center' }}>
                  Back to Event
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
