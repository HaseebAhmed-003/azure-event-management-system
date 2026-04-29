/**
 * EventForm.js — Member 2: Haseeb Ahmed
 *
 * Create AND Edit event form. Used at two routes:
 *   /organizer/events/new         → Create mode (isEdit = false)
 *   /organizer/events/:id/edit    → Edit mode   (isEdit = true)
 *
 * Mode detection:
 *   const { id } = useParams();
 *   const isEdit = Boolean(id);
 *   In Edit mode, getEvent(id) is called on mount to pre-fill the form.
 *
 * validate():
 *   Returns error string if title/venue/eventDate/totalSeats missing,
 *   or if totalSeats is less than 1, or ticketPrice is negative.
 *   Returns null if all checks pass.
 *
 * handleSubmit(e, shouldPublish):
 *   1. Runs validate() — stops on error
 *   2. Calls createEvent() or updateEvent() based on mode
 *   3. If banner file selected, calls uploadBanner(eventId, file)
 *      → sends multipart/form-data POST to /api/events/:id/banner
 *   4. If shouldPublish=true, calls publishEvent(eventId) after creation
 *   5. Redirects to /organizer/events on success
 *
 * Banner upload: hidden file input triggered by clicking a styled div.
 * Preview: URL.createObjectURL(file) shows image before saving.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createEvent, updateEvent, getEvent, uploadBanner, publishEvent } from '../api';

const INIT = { title: '', description: '', venue: '', eventDate: '', totalSeats: '', ticketPrice: '' };

export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(INIT);
  const [banner, setBanner] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (isEdit) {
      getEvent(id).then(r => {
        const ev = r.data;
        setForm({
          title: ev.title || '',
          description: ev.description || '',
          venue: ev.venue || '',
          eventDate: ev.eventDate ? ev.eventDate.slice(0, 16) : '',
          totalSeats: ev.totalSeats || '',
          ticketPrice: ev.ticketPrice || '0',
        });
        if (ev.bannerUrl) setBannerPreview(ev.bannerUrl);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleBanner = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return; }
    setBanner(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.venue.trim()) return 'Venue is required.';
    if (!form.eventDate) return 'Event date is required.';
    if (!form.totalSeats || parseInt(form.totalSeats) < 1) return 'Total seats must be at least 1.';
    if (form.ticketPrice === '' || parseFloat(form.ticketPrice) < 0) return 'Ticket price cannot be negative.';
    return null;
  };

  const handleSubmit = async (e, shouldPublish = false) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        totalSeats: parseInt(form.totalSeats),
        ticketPrice: parseFloat(form.ticketPrice) || 0,
        isFree: parseFloat(form.ticketPrice) === 0,
      };
      let ev;
      if (isEdit) {
        const res = await updateEvent(id, payload);
        ev = res.data;
      } else {
        const res = await createEvent(payload);
        ev = res.data;
      }

      // Upload banner if selected
      if (banner) {
        try { await uploadBanner(ev.id, banner); } catch {}
      }

      if (shouldPublish) {
        try { await publishEvent(ev.id); } catch {}
      }

      setSuccess(isEdit ? 'Event updated!' : `Event ${shouldPublish ? 'created and published' : 'created as draft'}!`);
      setTimeout(() => navigate('/organizer/events'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Edit Event' : 'Create Event'}</h1>
        <p className="page-sub">{isEdit ? 'Update your event details' : 'Fill in the details to create a new event'}</p>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {success && <div className="alert alert-success">✓ {success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ fontSize: 16, marginBottom: 16 }}>Basic Info</div>
          <div className="form-group">
            <label className="form-label">Event Title *</label>
            <input className="form-input" placeholder="e.g. Tech Conference Karachi 2026" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Describe your event…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
          </div>
          <div className="two-col">
            <div className="form-group">
              <label className="form-label">Venue / Location *</label>
              <input className="form-input" placeholder="e.g. Karachi Expo Center" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Event Date & Time *</label>
              <input className="form-input" type="datetime-local" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ fontSize: 16, marginBottom: 16 }}>Tickets & Capacity</div>
          <div className="two-col">
            <div className="form-group">
              <label className="form-label">Total Seats *</label>
              <input className="form-input" type="number" min="1" placeholder="e.g. 200" value={form.totalSeats} onChange={e => setForm({ ...form, totalSeats: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Ticket Price (PKR)</label>
              <input className="form-input" type="number" min="0" step="0.01" placeholder="0 for free event" value={form.ticketPrice} onChange={e => setForm({ ...form, ticketPrice: e.target.value })} />
              <span className="form-hint">Set to 0 to make this a free event</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 28 }}>
          <div className="section-title" style={{ fontSize: 16, marginBottom: 16 }}>Banner Image</div>
          {bannerPreview && (
            <div style={{ width: '100%', height: 180, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <img src={bannerPreview} alt="Banner preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div
            style={{ background: 'var(--surface2)', border: '2px dashed var(--border)', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => fileRef.current.click()}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>{banner ? banner.name : 'Click to upload banner (JPEG, PNG, WEBP — max 5MB)'}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBanner} />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-secondary btn-lg" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save as Draft'}
          </button>
          {!isEdit && (
            <button
              type="button"
              className="btn btn-accent btn-lg"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
            >
              {saving ? 'Saving…' : 'Save & Publish'}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate('/organizer/events')} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
